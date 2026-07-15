import AccountingEntry from '../../models/accounting-entry.model.js'
import AccountingTransaction from '../../models/accounting-transaction.model.js'
import Checkout from '../../models/checkout.model.js'
import Order from '../../models/order.model.js'
import PaymentAttempt from '../../models/payment-attempt.model.js'
import ReconciliationIssue from '../../models/reconciliation-issue.model.js'

const upsertIssue = (issue) => ReconciliationIssue.updateOne(
  { issueKey: issue.issueKey },
  { $set: issue, $setOnInsert: { status: 'open' } },
  { upsert: true }
)

export const runLocalReconciliation = async () => {
  const ledgerDrift = await AccountingEntry.aggregate([
    { $group: {
      _id: '$transaction',
      debit: { $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0] } },
      credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] } },
    } },
    { $match: { $expr: { $ne: ['$debit', '$credit'] } } },
  ])
  for (const drift of ledgerDrift) await upsertIssue({
    issueKey: `ledger_drift:${drift._id}`,
    issueType: 'ledger_drift',
    severity: 'critical',
    referenceType: 'AccountingTransaction',
    referenceId: drift._id,
    details: { debit: drift.debit, credit: drift.credit },
  })

  const succeededAttempts = await PaymentAttempt.find({ status: 'succeeded', checkout: { $ne: null } }).lean()
  let chainIssues = 0
  for (const attempt of succeededAttempts) {
    const [checkout, paidOrderCount, capture] = await Promise.all([
      Checkout.findById(attempt.checkout).lean(),
      Order.countDocuments({ _id: { $in: attempt.orders }, commerceStatus: { $ne: 'payment_pending' } }),
      AccountingTransaction.findOne({ commandKey: `payment_capture:${attempt._id}` }).lean(),
    ])
    if (checkout?.status === 'paid' && paidOrderCount === attempt.orders.length && capture) continue
    chainIssues += 1
    await upsertIssue({
      issueKey: `payment_chain:${attempt._id}`,
      issueType: 'payment_chain_mismatch',
      severity: 'critical',
      referenceType: 'PaymentAttempt',
      referenceId: attempt._id,
      details: { checkoutStatus: checkout?.status, paidOrderCount, orderCount: attempt.orders.length, hasCapture: Boolean(capture) },
    })
  }
  return {
    checkedPayments: succeededAttempts.length,
    ledgerDriftCount: ledgerDrift.length,
    paymentChainIssueCount: chainIssues,
    result: ledgerDrift.length === 0 && chainIssues === 0 ? 'matched' : 'issues_found',
  }
}
