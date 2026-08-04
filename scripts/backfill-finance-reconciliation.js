import mongoose from 'mongoose'
import { env } from '../src/configs/env.config.js'
import { connectDB, disconnectDB } from '../src/configs/database.config.js'
import Order from '../src/models/order.model.js'
import '../src/models/user.model.js'
import '../src/models/shop.model.js'
import '../src/models/product.model.js'
import '../src/models/category.model.js'
import LedgerTransaction from '../src/models/ledger-transaction.model.js'
import { settlePaidOrder } from '../src/services/ledger/ledger.service.js'
import { ORDER_STATUS, PAYMENT_STATUS } from '../src/constants/status.constant.js'
import { LEDGER_TRANSACTION_TYPE } from '../src/constants/ledger.constant.js'

const APPLY = process.argv.includes('--apply')

const assertTestDatabase = () => {
  const databaseName = env.mongodb.dbName || mongoose.connection.db?.databaseName || ''
  if (!databaseName.startsWith('anhdecor_test')) {
    throw new Error(`Từ chối chạy migration ngoài DB test: ${databaseName || 'không xác định'}`)
  }
}

const findOrdersMissingSettlement = async () => {
  const paidOrders = await Order.find({
    paymentStatus: PAYMENT_STATUS.PAID,
    status: { $ne: ORDER_STATUS.CANCELLED },
  })
    .select('_id totalAmount paymentStatus status createdAt')
    .sort({ createdAt: 1 })
    .lean()

  const settlements = await LedgerTransaction.find({
    transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT,
    referenceType: 'order',
    referenceId: { $in: paidOrders.map((order) => order._id) },
  })
    .select('referenceId')
    .lean()

  const settledOrderIds = new Set(settlements.map((transaction) => String(transaction.referenceId)))
  return paidOrders.filter((order) => !settledOrderIds.has(String(order._id)))
}

const main = async () => {
  await connectDB()
  assertTestDatabase()

  try {
    const missingOrders = await findOrdersMissingSettlement()
    console.log(JSON.stringify({
      database: mongoose.connection.db.databaseName,
      mode: APPLY ? 'apply' : 'dry-run',
      missingOrderCount: missingOrders.length,
      orders: missingOrders.map((order) => ({
        id: order._id,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
      })),
    }, null, 2))

    if (!APPLY || !missingOrders.length) {
      return
    }

    for (const order of missingOrders) {
      await settlePaidOrder(order._id, { source: 'legacy_finance_backfill' })
      console.log(`Đã bổ sung bút toán quyết toán cho đơn ${order._id}`)
    }

    const remaining = await findOrdersMissingSettlement()
    if (remaining.length) {
      throw new Error(`Còn ${remaining.length} đơn đã thanh toán chưa có bút toán sau migration`)
    }

    console.log('Hoàn tất bổ sung bút toán tài chính; không xoá giao dịch hoặc bút toán cũ.')
  } finally {
    await disconnectDB()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
