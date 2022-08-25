const { ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("./getWeth")

async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()
    const lendingPool = await getLendingPool(deployer)

    //get wethTokenAddress
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("depositing...")

    // depositing
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("deposited ", ethers.utils.formatEther(AMOUNT), " ETH")

    // borrowing
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)
    const daiPrice = await getDaiPrice()
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    console.log("you can borrow: ", amountDaiToBorrow, " DAI")
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
    await borrowDai(process.env.DAI_TOKEN_ADDRESS, lendingPool, amountDaiToBorrowWei, deployer)
    await getBorrowUserData(lendingPool, deployer)

    //repaying

    await repay(amountDaiToBorrowWei, process.env.DAI_TOKEN_ADDRESS, lendingPool, deployer)
    await getBorrowUserData(lendingPool, deployer)
}

async function repay(amount, daiAddress, lendingPool, account) {
    await approveErc20(daiAddress, lendingPool.address, amount, account)
    const repayTrx = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTrx.wait(1)
    console.log("repayed")
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrowWei, account) {
    const borrowTrx = await lendingPool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account)
    await borrowTrx.wait(1)
    console.log("you have borrowed")
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        process.env.DAI_ETH_PRICE_CHAINLINK_ADDRESS
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log("DAI/ETH price ", price.toString())
    return price
}

async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)
    console.log("totalCollateralETH: ", ethers.utils.formatEther(totalCollateralETH))
    console.log("totalDebtETH: ", ethers.utils.formatEther(totalDebtETH))
    console.log("availableBorrowsETH: ", ethers.utils.formatEther(availableBorrowsETH))
    return { availableBorrowsETH, totalDebtETH }
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        process.env.AAVE_LENDING_POOL_ADDRESS_PROVIDER,
        account
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendingPool
}
async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    const trx = await erc20Token.approve(spenderAddress, amountToSpend)
    await trx.wait(1)
    console.log("transaction approved")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
