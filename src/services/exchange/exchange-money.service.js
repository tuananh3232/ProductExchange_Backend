import AccountingTransaction from '../../models/accounting-transaction.model.js'
import UserWallet from '../../models/user-wallet.model.js'
import UserWalletTransaction from '../../models/user-wallet-transaction.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import ERRORS from '../../constants/error.constant.js'
import { USER_WALLET_TRANSACTION_TYPE } from '../../constants/status.constant.js'
import { runRequiredMongoTransaction } from '../../utils/mongo-transaction.util.js'
import { accountDefinitions, postBalancedTransaction } from '../accounting/accounting.service.js'

const findPosted = (commandKey, session) => AccountingTransaction.findOne({ commandKey }).session(session)

const createWalletActivity = async ({ wallet, user, type, amount, balanceBefore, balanceAfter, description, exchangeOfferId }, session) => {
  await UserWalletTransaction.create([{
    wallet,
    user,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    description,
    metadata: { exchangeOfferId },
  }], { session })
}

export const holdExchangePayment = async (exchangeOffer, payerUserId, amountDue) => {
  if (!amountDue) return null
  return runRequiredMongoTransaction(async (session) => {
    const commandKey = `exchange_hold:${exchangeOffer._id}`
    const existing = await findPosted(commandKey, session)
    if (existing) return existing
    const walletBefore = await UserWallet.findOne({ user: payerUserId }).session(session)
    const wallet = await UserWallet.findOneAndUpdate(
      { user: payerUserId, isActive: true, balance: { $gte: amountDue } },
      { $inc: { balance: -amountDue, totalSpent: amountDue } },
      { returnDocument: 'after', session }
    )
    if (!wallet) {
      throw new AppError('Số dư ví không đủ để thanh toán tiền bù trao đổi', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
    }
    await createWalletActivity({
      wallet: wallet._id,
      user: payerUserId,
      type: USER_WALLET_TRANSACTION_TYPE.EXCHANGE_PAYMENT,
      amount: amountDue,
      balanceBefore: walletBefore?.balance || 0,
      balanceAfter: wallet.balance,
      description: `Thanh toán tiền bù trao đổi #${exchangeOffer._id}`,
      exchangeOfferId: exchangeOffer._id,
    }, session)
    const posted = await postBalancedTransaction({
      commandKey,
      transactionType: 'exchange_payment_hold',
      referenceType: 'ExchangeOffer',
      referenceId: exchangeOffer._id,
      entries: [
        { account: accountDefinitions.userWallet(payerUserId), direction: 'debit', amount: amountDue },
        { account: accountDefinitions.exchangeEscrow(exchangeOffer._id), direction: 'credit', amount: amountDue },
      ],
    }, session)
    return posted.transaction
  })
}

export const releaseExchangeSettlement = async (exchangeOffer, adminId = null) => {
  const amountDue = exchangeOffer.cashDifferenceAmount + exchangeOffer.platformFee
  if (!amountDue) return null
  return runRequiredMongoTransaction(async (session) => {
    const commandKey = `exchange_release:${exchangeOffer._id}`
    const existing = await findPosted(commandKey, session)
    if (existing) return existing
    const entries = [{ account: accountDefinitions.exchangeEscrow(exchangeOffer._id), direction: 'debit', amount: amountDue }]
    if (exchangeOffer.platformFee > 0) {
      entries.push({ account: accountDefinitions.platformRevenue(), direction: 'credit', amount: exchangeOffer.platformFee })
    }
    if (exchangeOffer.cashDifferenceAmount > 0 && exchangeOffer.cashDifferenceReceiver) {
      const receiverId = exchangeOffer.cashDifferenceReceiver
      const before = await UserWallet.findOne({ user: receiverId }).session(session)
      const wallet = await UserWallet.findOneAndUpdate(
        { user: receiverId },
        { $inc: { balance: exchangeOffer.cashDifferenceAmount } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session }
      )
      await createWalletActivity({
        wallet: wallet._id,
        user: receiverId,
        type: USER_WALLET_TRANSACTION_TYPE.EXCHANGE_SETTLEMENT,
        amount: exchangeOffer.cashDifferenceAmount,
        balanceBefore: before?.balance || 0,
        balanceAfter: wallet.balance,
        description: `Nhận tiền bù trao đổi #${exchangeOffer._id}`,
        exchangeOfferId: exchangeOffer._id,
      }, session)
      entries.push({ account: accountDefinitions.userWallet(receiverId), direction: 'credit', amount: exchangeOffer.cashDifferenceAmount })
    }
    const posted = await postBalancedTransaction({
      commandKey,
      transactionType: 'exchange_settlement_release',
      referenceType: 'ExchangeOffer',
      referenceId: exchangeOffer._id,
      metadata: { adminId },
      entries,
    }, session)
    return posted.transaction
  })
}

export const refundExchangeHold = async (exchangeOffer, reason, actorUserId = null) => {
  const amount = exchangeOffer.cashDifferenceAmount + exchangeOffer.platformFee
  if (!amount || !exchangeOffer.cashDifferencePayer) return null
  return runRequiredMongoTransaction(async (session) => {
    const commandKey = `exchange_refund:${exchangeOffer._id}`
    const existing = await findPosted(commandKey, session)
    if (existing) return existing
    const payerId = exchangeOffer.cashDifferencePayer
    const before = await UserWallet.findOne({ user: payerId }).session(session)
    const wallet = await UserWallet.findOneAndUpdate(
      { user: payerId },
      { $inc: { balance: amount, totalSpent: -amount } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session }
    )
    await createWalletActivity({
      wallet: wallet._id,
      user: payerId,
      type: USER_WALLET_TRANSACTION_TYPE.EXCHANGE_REFUND,
      amount,
      balanceBefore: before?.balance || 0,
      balanceAfter: wallet.balance,
      description: `Hoàn tiền bù trao đổi #${exchangeOffer._id}`,
      exchangeOfferId: exchangeOffer._id,
    }, session)
    const posted = await postBalancedTransaction({
      commandKey,
      transactionType: 'exchange_refund',
      referenceType: 'ExchangeOffer',
      referenceId: exchangeOffer._id,
      metadata: { reason, actorUserId },
      entries: [
        { account: accountDefinitions.exchangeEscrow(exchangeOffer._id), direction: 'debit', amount },
        { account: accountDefinitions.userWallet(payerId), direction: 'credit', amount },
      ],
    }, session)
    return posted.transaction
  })
}
