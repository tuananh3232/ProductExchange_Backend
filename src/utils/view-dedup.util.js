const DEDUP_WINDOW_MS = 30 * 60 * 1000 // 1 lượt / viewer / sản phẩm / 30 phút

const viewCache = new Map()

/**
 * Trả true nếu đây là lượt xem trùng (viewer đã xem trong cửa sổ thời gian).
 * Nếu chưa xem hoặc đã hết window → ghi nhận thời điểm hiện tại, trả false.
 */
export const isDuplicateView = (productId, viewerKey) => {
  const key = `${productId}:${viewerKey}`
  const now = Date.now()
  const lastSeen = viewCache.get(key)

  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) return true

  viewCache.set(key, now)

  // Lazy cleanup: giải phóng bộ nhớ khi cache lớn
  if (viewCache.size > 10_000) {
    for (const [k, ts] of viewCache.entries()) {
      if (now - ts >= DEDUP_WINDOW_MS) viewCache.delete(k)
    }
  }

  return false
}
