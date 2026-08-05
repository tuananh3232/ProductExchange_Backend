import { runRentalMaintenance } from '../services/rental/rental.service.js'
import { expirePendingOrders, releaseDueOrderSettlements } from '../services/order/order.service.js'

// Chu kỳ chạy tác vụ nền (ms). Mặc định 15 phút, có thể override qua env.
const RENTAL_MAINTENANCE_INTERVAL_MS =
  parseInt(process.env.RENTAL_MAINTENANCE_INTERVAL_MS, 10) || 15 * 60 * 1000

let rentalTimer = null
let orderTimer = null

const runRentalTick = async () => {
  try {
    const { overdueCount } = await runRentalMaintenance()
    if (overdueCount > 0) {
      console.log(`⏰ Bảo trì thuê: ${overdueCount} booking chuyển sang quá hạn`)
    }
  } catch (error) {
    console.error('Bảo trì thuê thất bại:', error.message)
  }
}

const runOrderTick = async () => {
  try {
    const { expiredCount } = await expirePendingOrders()
    const { releasedCount } = await releaseDueOrderSettlements()
    if (expiredCount > 0) console.log(`Đã tự huỷ ${expiredCount} đơn hàng quá hạn thanh toán`)
    if (releasedCount > 0) console.log(`Đã giải ngân ${releasedCount} đơn hàng sau thời gian giữ tiền`)
  } catch (error) {
    console.error('Không thể xử lý đơn hàng quá hạn:', error.message)
  }
}

/**
 * Khởi động các job nền. Gọi sau khi đã kết nối DB.
 * Dùng setInterval (không thêm dependency); chạy ngay 1 lần lúc boot rồi lặp lại.
 */
export const startSchedulers = () => {
  if (rentalTimer) {
    return
  }

  runRentalTick()
  runOrderTick()
  rentalTimer = setInterval(runRentalTick, RENTAL_MAINTENANCE_INTERVAL_MS)
  orderTimer = setInterval(runOrderTick, 60 * 1000)
  if (typeof rentalTimer.unref === 'function') {
    rentalTimer.unref()
  }
}

export const stopSchedulers = () => {
  if (rentalTimer) {
    clearInterval(rentalTimer)
    rentalTimer = null
  }
  if (orderTimer) {
    clearInterval(orderTimer)
    orderTimer = null
  }
}
