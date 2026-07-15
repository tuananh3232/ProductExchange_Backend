import { resetTestDatabase } from '../setup/test-db.js'
import { createTestUser } from '../setup/auth.js'
import { createSampleOrder, createSampleProduct } from '../setup/factories.js'
import Checkout from '../../src/models/checkout.model.js'
import OrderCase from '../../src/models/order-case.model.js'
import PaymentAttempt from '../../src/models/payment-attempt.model.js'
import Refund from '../../src/models/refund.model.js'
import UserWallet from '../../src/models/user-wallet.model.js'
import UserWalletWithdrawal from '../../src/models/user-wallet-withdrawal.model.js'
import UserWalletTransaction from '../../src/models/user-wallet-transaction.model.js'
import AccountingEntry from '../../src/models/accounting-entry.model.js'
import * as refundService from '../../src/services/refund/refund.service.js'
import { completeUserWithdrawal } from '../../src/services/user-wallet/user-wallet.service.js'

beforeEach(async () => resetTestDatabase())

const createCapturedOrderCase = async ({ provider = 'wallet', total = 100000 } = {}) => {
  const [buyer, admin, product] = await Promise.all([createTestUser(), createTestUser({ roles: ['admin'] }), createSampleProduct()])
  const checkout = await Checkout.create({
    buyer: buyer._id,
    idempotencyKey: `refund-checkout-${provider}`,
    items: [],
    orders: [],
    reservations: [],
    shippingAddress: { recipientName: 'Buyer', phone: '0901234567', province: 'Test', district: 'Test', detail: '123 Test' },
    amount: { subtotal: total, discount: 0, shippingFee: 0, tax: 0, total },
    status: 'paid',
    expiresAt: new Date(Date.now() + 60000),
  })
  const order = await createSampleOrder({
    buyer: buyer._id,
    product,
    checkout: checkout._id,
    totalAmount: total,
    amountBreakdown: { subtotal: total, discount: 0, shippingFee: 0, tax: 0, total },
    commerceStatus: 'disputed',
    paymentStatus: 'paid',
  })
  const payment = await PaymentAttempt.create({
    checkout: checkout._id,
    orders: [order._id],
    buyer: buyer._id,
    provider,
    method: provider,
    amount: total,
    idempotencyKey: `refund-payment-${provider}`,
    merchantReference: `REFUND-${provider.toUpperCase()}-1`,
    status: 'succeeded',
  })
  const orderCase = await OrderCase.create({ order: order._id, openedBy: buyer._id, type: 'dispute', reason: 'Product differs materially from its snapshot.' })
  return { buyer, admin, order, payment, orderCase }
}

describe('commerce refund and withdrawal acceptance', () => {
  it('keeps partial refund resolution and wallet processing idempotent while rejecting over-refund', async () => {
    const { buyer, admin, order, orderCase } = await createCapturedOrderCase()
    await UserWallet.create({ user: buyer._id, balance: 0 })

    const first = await refundService.resolveOrderCase({ caseId: orderCase._id, adminId: admin._id, resolution: 'partial_refund', amount: 60000, note: 'Partial refund accepted', idempotencyKey: 'partial-refund-resolution-1' })
    const replay = await refundService.resolveOrderCase({ caseId: orderCase._id, adminId: admin._id, resolution: 'partial_refund', amount: 60000, note: 'Partial refund accepted', idempotencyKey: 'partial-refund-resolution-1' })
    expect(replay.refund._id.toString()).toBe(first.refund._id.toString())
    expect(await Refund.countDocuments()).toBe(1)

    const secondCase = await OrderCase.create({ order: order._id, openedBy: buyer._id, type: 'return', reason: 'Second refund request must respect captured total.' })
    await expect(refundService.resolveOrderCase({ caseId: secondCase._id, adminId: admin._id, resolution: 'partial_refund', amount: 50000, note: 'Would exceed capture', idempotencyKey: 'partial-refund-resolution-2' })).rejects.toMatchObject({ errorCode: 'REFUND_AMOUNT_EXCEEDED' })

    const results = await Promise.all([
      refundService.processRefund(first.refund._id, admin._id),
      refundService.processRefund(first.refund._id, admin._id),
    ])
    expect(results.every((item) => item.status === 'succeeded')).toBe(true)
    expect((await UserWallet.findOne({ user: buyer._id })).balance).toBe(60000)
    expect((await order.constructor.findById(order._id)).commerceStatus).toBe('partially_refunded')
    expect(await AccountingEntry.countDocuments()).toBe(2)
  })

  it('confirms a PayOS manual refund once for a repeated evidence reference', async () => {
    const { admin, orderCase } = await createCapturedOrderCase({ provider: 'payos', total: 80000 })
    const { refund } = await refundService.resolveOrderCase({ caseId: orderCase._id, adminId: admin._id, resolution: 'full_refund', note: 'Full PayOS refund', idempotencyKey: 'payos-manual-resolution-1' })
    expect((await refundService.processRefund(refund._id, admin._id)).status).toBe('manual_required')
    const evidence = { transactionId: 'MANUAL-TX-1', bankTransferRef: 'BANK-REF-UNIQUE-1', transferredAt: new Date(), note: 'Verified bank transfer' }
    const first = await refundService.confirmManualRefund({ refundId: refund._id, adminId: admin._id, evidence })
    const replay = await refundService.confirmManualRefund({ refundId: refund._id, adminId: admin._id, evidence })
    expect(first.status).toBe('succeeded')
    expect(replay._id.toString()).toBe(first._id.toString())
    expect(await AccountingEntry.countDocuments()).toBe(4)
  })

  it('allows only one concurrent withdrawal completion and never double-debits pending balance', async () => {
    const [user, approver, checker] = await Promise.all([createTestUser(), createTestUser({ roles: ['admin'] }), createTestUser({ roles: ['admin'] })])
    const wallet = await UserWallet.create({ user: user._id, balance: 100000, pendingBalance: 50000 })
    const withdrawal = await UserWalletWithdrawal.create({
      user: user._id,
      wallet: wallet._id,
      amount: 50000,
      bankInfo: { bankName: 'Test Bank', accountNumber: '123456789', accountName: 'TEST USER' },
      status: 'approved',
      approvedBy: approver._id,
      approvedAt: new Date(),
    })
    const transferProof = { transactionId: 'PAYOUT-1', transferDate: new Date(), bankTransferRef: 'PAYOUT-BANK-REF-1', note: 'Acceptance test' }
    const results = await Promise.allSettled([
      completeUserWithdrawal(withdrawal._id, checker, 'Completed', transferProof),
      completeUserWithdrawal(withdrawal._id, checker, 'Completed', transferProof),
    ])
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    const savedWallet = await UserWallet.findById(wallet._id)
    expect(savedWallet.pendingBalance).toBe(0)
    expect(savedWallet.totalWithdrawn).toBe(50000)
    expect(await UserWalletTransaction.countDocuments({ 'metadata.withdrawalId': withdrawal._id })).toBe(1)
    expect(await AccountingEntry.countDocuments()).toBe(2)
  })
})
