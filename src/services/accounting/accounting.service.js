import AccountingAccount from '../../models/accounting-account.model.js'
import AccountingEntry from '../../models/accounting-entry.model.js'
import AccountingTransaction from '../../models/accounting-transaction.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const accountBalanceDelta = (accountType, direction, amount) => {
  const normalDirection = accountType === 'asset' ? 'debit' : 'credit'
  return direction === normalDirection ? amount : -amount
}

const getOrCreateAccount = async (definition, session) => AccountingAccount.findOneAndUpdate(
  { key: definition.key },
  { $setOnInsert: definition },
  { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session }
)

export const postBalancedTransaction = async ({
  commandKey,
  transactionType,
  referenceType,
  referenceId,
  description = '',
  metadata = {},
  entries,
}, session) => {
  if (!session) {
    throw new AppError('Bút toán tài chính bắt buộc chạy trong transaction', HTTP_STATUS.INTERNAL_SERVER_ERROR, 'TRANSACTION_REQUIRED')
  }

  const debitTotal = entries.filter((entry) => entry.direction === 'debit').reduce((sum, entry) => sum + entry.amount, 0)
  const creditTotal = entries.filter((entry) => entry.direction === 'credit').reduce((sum, entry) => sum + entry.amount, 0)
  if (debitTotal <= 0 || debitTotal !== creditTotal) {
    throw new AppError('Bút toán kép không cân bằng', HTTP_STATUS.INTERNAL_SERVER_ERROR, 'UNBALANCED_LEDGER')
  }

  const existing = await AccountingTransaction.findOne({ commandKey }).session(session)
  if (existing) return existing

  const [transaction] = await AccountingTransaction.create([{
    commandKey,
    transactionType,
    referenceType,
    referenceId,
    amount: debitTotal,
    description,
    metadata,
  }], { session })

  const savedEntries = []
  for (const entry of entries) {
    const account = await getOrCreateAccount(entry.account, session)
    const balanceDelta = accountBalanceDelta(account.type, entry.direction, entry.amount)
    const updatedAccount = await AccountingAccount.findByIdAndUpdate(
      account._id,
      { $inc: { balance: balanceDelta } },
      { returnDocument: 'after', session }
    )
    const [savedEntry] = await AccountingEntry.create([{
      transaction: transaction._id,
      account: account._id,
      direction: entry.direction,
      amount: entry.amount,
      balanceAfter: updatedAccount.balance,
    }], { session })
    savedEntries.push(savedEntry)
  }

  return { transaction, entries: savedEntries }
}

export const accountDefinitions = {
  providerClearing: (provider) => ({ key: `provider_clearing:${provider}`, type: 'asset', ownerType: 'provider' }),
  orderEscrow: (checkoutId) => ({ key: `order_escrow:${checkoutId}`, type: 'liability', ownerType: 'platform' }),
  exchangeEscrow: (exchangeId) => ({ key: `exchange_escrow:${exchangeId}`, type: 'liability', ownerType: 'platform' }),
  rentalEscrow: (bookingId) => ({ key: `rental_escrow:${bookingId}`, type: 'liability', ownerType: 'platform' }),
  userWallet: (userId) => ({ key: `user_wallet:${userId}`, type: 'liability', ownerType: 'user', ownerId: userId }),
  shopAvailable: (shopId) => ({ key: `shop_available:${shopId}`, type: 'liability', ownerType: 'shop', ownerId: shopId }),
  sellerAvailable: (userId) => ({ key: `seller_available:${userId}`, type: 'liability', ownerType: 'user', ownerId: userId }),
  platformRevenue: () => ({ key: 'platform_revenue:vnd', type: 'revenue', ownerType: 'platform' }),
  refundPayable: (refundId) => ({ key: `refund_payable:${refundId}`, type: 'liability', ownerType: 'platform' }),
  withdrawalPending: (withdrawalId, ownerType, ownerId) => ({
    key: `withdrawal_pending:${withdrawalId}`,
    type: 'liability',
    ownerType,
    ownerId,
  }),
}
