import mongoose from 'mongoose'
import { connectDB, disconnectDB } from '../src/configs/database.config.js'
import Product from '../src/models/product.model.js'
import Order from '../src/models/order.model.js'
import Payment from '../src/models/payment.model.js'
import PaymentAttempt from '../src/models/payment-attempt.model.js'
import Wallet from '../src/models/wallet.model.js'
import UserWallet from '../src/models/user-wallet.model.js'
import AccountingAccount from '../src/models/accounting-account.model.js'
import SubscriptionOrder from '../src/models/subscription-order.model.js'
import RoomProject from '../src/models/room-project.model.js'
import RoomScene from '../src/models/room-scene.model.js'
import RentalBooking from '../src/models/rental-booking.model.js'
import RentalSlot from '../src/models/rental-slot.model.js'
import WithdrawalRequest from '../src/models/withdrawal-request.model.js'
import UserWalletWithdrawal from '../src/models/user-wallet-withdrawal.model.js'
import Counter from '../src/models/counter.model.js'

const apply = process.argv.includes('--apply')
const dryRun = process.argv.includes('--dry-run') || !apply
mongoose.set('autoIndex', false)
const checkpointCollection = () => mongoose.connection.collection('migration_checkpoints')
const stats = { products: 0, orders: 0, payments: 0, subscriptions: 0, rentalSlots: 0, visualizerRecords: 0, accounts: 0, manualReconciliation: 0 }

const migrateProducts = async () => {
  for await (const product of Product.find({ $or: [{ variants: { $exists: false } }, { variants: { $size: 0 } }] }).cursor()) {
    stats.products += 1
    if (!dryRun) {
      product.variants = [{
        sku: `LEGACY-${String(product._id).slice(-12)}`,
        attributes: { version: 'default' },
        price: Math.round(Number(product.price)),
        stockOnHand: Number(product.stock || 0),
        reservedStock: 0,
        isActive: true,
      }]
      await product.save()
    }
  }
}

const migrateOrders = async () => {
  for await (const order of Order.find({ $or: [{ items: { $exists: false } }, { items: { $size: 0 } }] }).cursor()) {
    const product = await Product.findById(order.product).select('title images variants')
    if (!product || (!dryRun && !product.variants?.[0])) {
      stats.manualReconciliation += 1
      continue
    }
    stats.orders += 1
    if (!dryRun) {
      const variant = product.variants[0]
      order.items = [{
        product: product._id,
        variantId: variant._id,
        sku: variant.sku,
        title: product.title,
        image: product.images?.find((image) => image.isPrimary)?.url || product.images?.[0]?.url || '',
        attributes: variant.attributes,
        quantity: order.quantity,
        unitPrice: Math.round(Number(order.unitPrice)),
        subtotal: Math.round(Number(order.totalAmount)),
      }]
      order.amountBreakdown = { subtotal: order.totalAmount, discount: 0, shippingFee: 0, tax: 0, total: order.totalAmount }
      await order.save()
    }
  }
}

const paymentStatus = (status) => ({
  paid: 'succeeded',
  failed: 'failed',
  cancelled: 'cancelled',
  pending_payment: 'pending',
  unpaid: 'created',
}[status] || 'failed')

const migratePayments = async () => {
  for await (const payment of Payment.find().cursor()) {
    if (await PaymentAttempt.exists({ legacyPayment: payment._id })) continue
    stats.payments += 1
    if (!dryRun) await PaymentAttempt.create({
      checkout: null,
      legacyPayment: payment._id,
      orders: payment.orders?.length ? payment.orders : [payment.order].filter(Boolean),
      buyer: payment.buyer,
      provider: ['payos', 'vnpay', 'wallet'].includes(payment.provider) ? payment.provider : 'wallet',
      method: payment.method,
      amount: Math.max(1, Math.round(Number(payment.amount))),
      idempotencyKey: `legacy:${payment._id}`,
      merchantReference: `legacy:${payment.transactionRef}`,
      ...(payment.vnpTransactionNo ? { providerReference: payment.vnpTransactionNo } : {}),
      ...(payment.rawCallbackData?.vnp_PayDate ? { providerTransactionDate: payment.rawCallbackData.vnp_PayDate } : {}),
      status: paymentStatus(payment.status),
      reconciliationState: payment.reconciliationState === 'matched' ? 'matched' : 'issue',
      failureReason: payment.failureReason || '',
      paidAt: payment.paidAt,
    })
  }
}

const migrateSubscriptions = async () => {
  for await (const subscription of SubscriptionOrder.find({
    $or: [
      { idempotencyKey: { $exists: false } },
      { paymentMethod: { $exists: false } },
    ],
  }).cursor()) {
    stats.subscriptions += 1
    if (!dryRun) {
      subscription.idempotencyKey = subscription.idempotencyKey || `legacy:${subscription._id}`
      subscription.paymentMethod = subscription.paymentMethod || (subscription.transactionRef?.includes('WALLET') ? 'wallet' : 'payos')
      await subscription.save()
    }
  }
}

const migrateVisualizerQuota = async () => {
  const projectSlots = new Map()
  for await (const project of RoomProject.find({ quotaSlot: null }).sort({ createdAt: 1 }).cursor()) {
    const key = String(project.owner)
    const slot = projectSlots.get(key) || 0
    projectSlots.set(key, slot + 1)
    stats.visualizerRecords += 1
    if (slot >= 10) stats.manualReconciliation += 1
    if (!dryRun) {
      project.quotaSlot = slot
      project.quotaActive = project.status !== 'archived' && slot < 10
      await project.save()
    }
  }
  const sceneSlots = new Map()
  for await (const scene of RoomScene.find({ quotaSlot: null }).sort({ createdAt: 1 }).cursor()) {
    const key = String(scene.project)
    const slot = sceneSlots.get(key) || 0
    sceneSlots.set(key, slot + 1)
    stats.visualizerRecords += 1
    if (slot >= 10) stats.manualReconciliation += 1
    if (!dryRun) {
      scene.quotaSlot = slot
      scene.quotaActive = scene.isActive && slot < 10
      await scene.save()
    }
  }
}

const migrateRentalSlots = async () => {
  const activeStatuses = ['payment_pending', 'confirmed', 'ready_for_handover', 'in_rental', 'return_pending_confirmation', 'overdue', 'disputed']
  for await (const booking of RentalBooking.find({ isActive: true, status: { $in: activeStatuses } }).cursor()) {
    const cursor = new Date(booking.startDate)
    cursor.setHours(0, 0, 0, 0)
    for (let offset = 0; offset < booking.plannedDays; offset += 1) {
      const date = new Date(cursor)
      date.setDate(date.getDate() + offset)
      const existing = await RentalSlot.findOne({ listing: booking.listing, date }).lean()
      if (existing && String(existing.booking) !== String(booking._id)) {
        stats.manualReconciliation += 1
        continue
      }
      if (!existing) {
        stats.rentalSlots += 1
        if (!dryRun) await RentalSlot.create({ listing: booking.listing, booking: booking._id, date })
      }
    }
  }
}

const createOpeningAccounts = async () => {
  const shopWallets = await Wallet.find({ $or: [{ balance: { $gt: 0 } }, { pendingBalance: { $gt: 0 } }] }).lean()
  const userWallets = await UserWallet.find({ $or: [{ balance: { $gt: 0 } }, { pendingBalance: { $gt: 0 } }] }).lean()
  const shopWithdrawals = await WithdrawalRequest.find({ status: { $in: ['pending', 'approved', 'processing'] } }).lean()
  const userWithdrawals = await UserWalletWithdrawal.find({ status: { $in: ['pending', 'approved', 'processing'] } }).lean()
  const definitions = [
    ...shopWallets.map((wallet) => ({ key: `shop_available:${wallet.shop}`, type: 'liability', ownerType: 'shop', ownerId: wallet.shop, balance: wallet.balance })),
    ...userWallets.map((wallet) => ({ key: `user_wallet:${wallet.user}`, type: 'liability', ownerType: 'user', ownerId: wallet.user, balance: wallet.balance })),
    ...shopWithdrawals.map((withdrawal) => ({ key: `withdrawal_pending:${withdrawal._id}`, type: 'liability', ownerType: 'shop', ownerId: withdrawal.shop, balance: withdrawal.amount })),
    ...userWithdrawals.map((withdrawal) => ({ key: `withdrawal_pending:${withdrawal._id}`, type: 'liability', ownerType: 'user', ownerId: withdrawal.user, balance: withdrawal.amount })),
  ]
  stats.accounts = definitions.length
  if (!dryRun) {
    for (const definition of definitions) {
      await AccountingAccount.updateOne({ key: definition.key }, { $setOnInsert: definition }, { upsert: true })
    }
  }
}

const migrateDurableCounters = async () => {
  const highestAttempt = await PaymentAttempt.findOne({ providerOrderCode: { $ne: null } }).sort({ providerOrderCode: -1 }).select('providerOrderCode').lean()
  const legacyRefs = await Payment.find({ transactionRef: /^PAYOS_/ }).select('transactionRef').lean()
  const highestLegacy = legacyRefs.reduce((highest, payment) => {
    const value = Number(String(payment.transactionRef).replace('PAYOS_', ''))
    return Number.isInteger(value) ? Math.max(highest, value) : highest
  }, 0)
  const highest = Math.max(Number(highestAttempt?.providerOrderCode || 0), highestLegacy)
  if (!dryRun && highest > 0) {
    await Counter.updateOne(
      { key: 'payos_order_code_v1' },
      { $max: { value: highest } },
      { upsert: true }
    )
  }
}

const migrateTopupActivityIndex = async () => {
  if (dryRun) return
  const collection = mongoose.connection.collection('userwallettransactions')
  let indexes = []
  try {
    indexes = await collection.indexes()
  } catch (error) {
    if (error?.codeName !== 'NamespaceNotFound') throw error
  }
  const incompatible = indexes.find((index) => index.name === 'topup_1' && index.unique)
  if (incompatible) await collection.dropIndex(incompatible.name)
  await collection.createIndex(
    { topup: 1 },
    { unique: true, partialFilterExpression: { topup: { $type: 'objectId' } }, name: 'unique_topup_activity_v1' }
  )
}

const migratePaymentAttemptIndexes = async () => {
  if (dryRun) return
  const collection = mongoose.connection.collection('paymentattempts')
  let indexes = []
  try {
    indexes = await collection.indexes()
  } catch (error) {
    if (error?.codeName !== 'NamespaceNotFound') throw error
  }

  const definitions = [
    {
      name: 'provider_1_providerReference_1',
      key: { provider: 1, providerReference: 1 },
      partialFilterExpression: { providerReference: { $type: 'string' } },
    },
    {
      name: 'provider_1_providerOrderCode_1',
      key: { provider: 1, providerOrderCode: 1 },
      partialFilterExpression: { providerOrderCode: { $type: 'number' } },
    },
  ]

  for (const definition of definitions) {
    const existing = indexes.find((index) => index.name === definition.name)
    const isCompatible = existing && JSON.stringify(existing.partialFilterExpression) === JSON.stringify(definition.partialFilterExpression)
    if (existing && !isCompatible) await collection.dropIndex(existing.name)
    if (!isCompatible) {
      await collection.createIndex(definition.key, {
        name: definition.name,
        unique: true,
        partialFilterExpression: definition.partialFilterExpression,
      })
    }
  }
}

const main = async () => {
  await connectDB()
  if (apply && process.env.MIGRATION_BACKUP_CONFIRMED !== 'true') {
    throw new Error('Từ chối --apply: cần đặt MIGRATION_BACKUP_CONFIRMED=true sau khi đã backup và thử khôi phục')
  }
  const previous = await checkpointCollection().findOne({ key: { $in: ['marketplace-v1', 'marketplace-v2'] } })
  if (previous?.status === 'completed' && apply) throw new Error('Migration marketplace-v1 đã hoàn tất trước đó')
  await migrateProducts()
  await migrateOrders()
  await migratePaymentAttemptIndexes()
  await migratePayments()
  await migrateSubscriptions()
  await migrateRentalSlots()
  await migrateVisualizerQuota()
  await createOpeningAccounts()
  await migrateDurableCounters()
  await migrateTopupActivityIndex()
  if (!dryRun) await checkpointCollection().updateOne(
    { key: 'marketplace-v1' },
    { $set: { status: 'completed', completedAt: new Date(), stats } },
    { upsert: true }
  )
  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'apply', stats }, null, 2))
  await disconnectDB()
}

main().catch(async (error) => {
  console.error(error.message)
  await disconnectDB()
  process.exitCode = 1
})
