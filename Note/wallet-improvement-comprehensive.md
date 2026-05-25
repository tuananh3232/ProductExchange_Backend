# Wallet Flow - Cải Tiến Toàn Diện (Recommended)

## 🎯 Mục Tiêu
- Tách biệt rõ ràng `balance` (có thể rút) và `pendingBalance` (đang xử lý)
- Thêm trạng thái PROCESSING cho withdrawal
- Tăng cường audit trail và transparency
- Thêm notification system
- Reconciliation report

---

## 1. Cập Nhật Status Constants

```javascript
// src/constants/status.constant.js
export const WITHDRAWAL_STATUS = {
  PENDING: 'pending',           // Shop vừa tạo, chờ admin duyệt
  APPROVED: 'approved',         // Admin đã duyệt, chuẩn bị chuyển tiền
  PROCESSING: 'processing',     // Admin đang chuyển tiền
  COMPLETED: 'completed',       // Đã chuyển tiền thành công
  REJECTED: 'rejected',         // Admin từ chối
  FAILED: 'failed',            // Chuyển tiền thất bại (có thể retry)
}
```

## 2. Cập Nhật Wallet Model

```javascript
// src/models/wallet.model.js
const walletSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    unique: true,
    index: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
    // Số tiền CÓ THỂ RÚT ngay lập tức
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0,
    // Số tiền ĐANG CHỜ XỬ LÝ (withdrawal pending/approved/processing)
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0,
    // Tổng tiền đã nhận từ orders (sau trừ platform fee)
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: 0,
    // Tổng tiền đã rút thành công
  },
  totalPlatformFee: {
    type: Number,
    default: 0,
    min: 0,
    // Tổng platform fee đã trừ
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  versionKey: false,
})

// Virtual field: tổng số dư (balance + pendingBalance)
walletSchema.virtual('totalBalance').get(function() {
  return this.balance + this.pendingBalance
})
```

---

## 3. Cập Nhật Withdrawal Request Model

```javascript
// src/models/withdrawal-request.model.js
const withdrawalRequestSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    index: true,
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true,
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  bankInfo: {
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    bankBranch: { type: String, default: '' },
  },
  status: {
    type: String,
    enum: WITHDRAWAL_STATUS_ENUM,
    default: WITHDRAWAL_STATUS.PENDING,
    index: true,
  },
  note: {
    type: String,
    default: '',
  },
  adminNote: {
    type: String,
    default: '',
  },
  
  // Audit trail fields
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  
  // Transfer proof
  transferProof: {
    transactionId: { type: String, default: '' },
    transferDate: { type: Date, default: null },
    bankTransferRef: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  
  rejectionReason: {
    type: String,
    default: '',
  },
  
  // Retry tracking for failed transfers
  retryCount: {
    type: Number,
    default: 0,
  },
  lastFailureReason: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
  versionKey: false,
})
```

---

## 4. Cập Nhật Wallet Repository

```javascript
// src/repositories/wallet/wallet.repository.js

/**
 * Chuyển tiền từ balance sang pendingBalance khi tạo withdrawal request
 */
export const moveToPending = async (shopId, amount) => {
  return Wallet.findOneAndUpdate(
    {
      shop: shopId,
      balance: { $gte: amount },
      isActive: true,
    },
    {
      $inc: {
        balance: -amount,
        pendingBalance: amount,
      },
    },
    { new: true }
  )
}

/**
 * Hoàn tiền từ pendingBalance về balance khi reject/fail
 */
export const revertFromPending = async (shopId, amount) => {
  return Wallet.findOneAndUpdate(
    {
      shop: shopId,
      pendingBalance: { $gte: amount },
      isActive: true,
    },
    {
      $inc: {
        balance: amount,
        pendingBalance: -amount,
      },
    },
    { new: true }
  )
}

/**
 * Trừ pendingBalance khi complete withdrawal
 */
export const deductFromPending = async (shopId, amount) => {
  return Wallet.findOneAndUpdate(
    {
      shop: shopId,
      pendingBalance: { $gte: amount },
      isActive: true,
    },
    {
      $inc: {
        pendingBalance: -amount,
        totalWithdrawn: amount,
      },
    },
    { new: true }
  )
}

/**
 * Credit tiền vào wallet khi order delivered
 */
export const creditFromOrder = async (shopId, netAmount, platformFee) => {
  return Wallet.findOneAndUpdate(
    { shop: shopId },
    {
      $inc: {
        balance: netAmount,
        totalEarned: netAmount,
        totalPlatformFee: platformFee,
      },
    },
    { new: true, upsert: true }
  )
}
```

---

## 5. Cập Nhật Wallet Service

```javascript
// src/services/wallet/wallet.service.js

export const requestWithdrawal = async (shopId, userContext, payload) => {
  await assertShopOwnerOnly(shopId, userContext._id)

  // Validate amount
  if (payload.amount < WALLET_CONSTANTS.MIN_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      `Số tiền rút tối thiểu là ${WALLET_CONSTANTS.MIN_WITHDRAWAL_AMOUNT.toLocaleString('vi-VN')} VNĐ`,
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WALLET.AMOUNT_TOO_LOW
    )
  }

  // Check pending withdrawal
  const hasPending = await withdrawalRepo.hasPendingRequest(shopId)
  if (hasPending) {
    throw new AppError(
      'Bạn đang có lệnh rút tiền đang chờ xử lý',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WALLET.PENDING_WITHDRAWAL_EXISTS
    )
  }

  const wallet = await walletRepo.findOrCreateByShop(shopId)

  // Atomic move to pending
  const updatedWallet = await walletRepo.moveToPending(shopId, payload.amount)
  if (!updatedWallet) {
    throw new AppError(
      'Số dư không đủ để thực hiện lệnh rút',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WALLET.INSUFFICIENT_BALANCE
    )
  }

  const withdrawal = await withdrawalRepo.create({
    shop: shopId,
    wallet: wallet._id,
    requestedBy: userContext._id,
    amount: payload.amount,
    bankInfo: payload.bankInfo,
    note: payload.note || '',
  })

  // TODO: Send notification to admin
  // await notificationService.notifyAdminNewWithdrawal(withdrawal)

  return withdrawal
}

export const approveWithdrawal = async (withdrawalId, userContext) => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new AppError(
      'Lệnh rút tiền không ở trạng thái chờ duyệt',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WITHDRAWAL.INVALID_STATUS
    )
  }

  const updated = await withdrawalRepo.updateById(withdrawalId, {
    status: WITHDRAWAL_STATUS.APPROVED,
    approvedBy: userContext._id,
    approvedAt: new Date(),
  })

  // TODO: Send notification to shop
  // await notificationService.notifyShopWithdrawalApproved(updated)

  return updated
}

export const rejectWithdrawal = async (withdrawalId, userContext, rejectionReason, adminNote = '') => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new AppError(
      'Lệnh rút tiền không ở trạng thái chờ duyệt',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WITHDRAWAL.INVALID_STATUS
    )
  }

  const shopId = request.shop?._id || request.shop
  
  // Revert from pending to balance
  await walletRepo.revertFromPending(shopId, request.amount)

  const updated = await withdrawalRepo.updateById(withdrawalId, {
    status: WITHDRAWAL_STATUS.REJECTED,
    rejectionReason,
    adminNote,
    approvedBy: userContext._id,
    approvedAt: new Date(),
  })

  // TODO: Send notification to shop
  // await notificationService.notifyShopWithdrawalRejected(updated)

  return updated
}

export const startProcessingWithdrawal = async (withdrawalId, userContext) => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.APPROVED) {
    throw new AppError(
      'Lệnh rút tiền chưa được duyệt',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WITHDRAWAL.INVALID_STATUS
    )
  }

  return withdrawalRepo.updateById(withdrawalId, {
    status: WITHDRAWAL_STATUS.PROCESSING,
    processedBy: userContext._id,
    processedAt: new Date(),
  })
}

export const completeWithdrawal = async (withdrawalId, userContext, payload) => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.PROCESSING) {
    throw new AppError(
      'Lệnh rút tiền chưa ở trạng thái đang xử lý',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WITHDRAWAL.INVALID_STATUS
    )
  }

  const shopId = request.shop?._id || request.shop
  
  // Deduct from pendingBalance
  await walletRepo.deductFromPending(shopId, request.amount)

  // Create debit transaction
  await walletRepo.createTransaction({
    wallet: request.wallet,
    shop: shopId,
    type: WALLET_TRANSACTION_TYPE.DEBIT,
    grossAmount: request.amount,
    platformFee: 0,
    netAmount: request.amount,
    description: `Rút tiền lệnh #${withdrawalId}`,
    metadata: {
      withdrawalId,
      transferProof: payload.transferProof,
    },
  })

  const updated = await withdrawalRepo.updateById(withdrawalId, {
    status: WITHDRAWAL_STATUS.COMPLETED,
    adminNote: payload.adminNote || '',
    completedBy: userContext._id,
    completedAt: new Date(),
    transferProof: payload.transferProof,
  })

  // TODO: Send notification to shop
  // await notificationService.notifyShopWithdrawalCompleted(updated)

  return updated
}

export const failWithdrawal = async (withdrawalId, userContext, failureReason, adminNote = '') => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.PROCESSING) {
    throw new AppError(
      'Lệnh rút tiền không ở trạng thái đang xử lý',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WITHDRAWAL.INVALID_STATUS
    )
  }

  const shopId = request.shop?._id || request.shop
  
  // Revert from pending to balance
  await walletRepo.revertFromPending(shopId, request.amount)

  return withdrawalRepo.updateById(withdrawalId, {
    status: WITHDRAWAL_STATUS.FAILED,
    lastFailureReason: failureReason,
    adminNote,
    $inc: { retryCount: 1 },
  })
}
```

---

## 6. Thêm API Endpoints Mới

```javascript
// src/routes/wallet.route.js

// Admin starts processing withdrawal (before actual bank transfer)
router.patch(
  '/admin/withdrawals/:id/process',
  authenticate,
  authorize(['admin']),
  validateObjectId('id'),
  walletController.startProcessingWithdrawal
)

// Admin marks withdrawal as failed (can retry later)
router.patch(
  '/admin/withdrawals/:id/fail',
  authenticate,
  authorize(['admin']),
  validateObjectId('id'),
  validate(failWithdrawalSchema),
  walletController.failWithdrawal
)
```

---

## 7. Reconciliation Report Service

```javascript
// src/services/wallet/reconciliation.service.js

export const getReconciliationReport = async (shopId, startDate, endDate) => {
  const [
    ordersDelivered,
    walletTransactions,
    withdrawals,
    wallet,
  ] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          shop: mongoose.Types.ObjectId(shopId),
          status: ORDER_STATUS.DELIVERED,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]),
    WalletTransaction.aggregate([
      {
        $match: {
          shop: mongoose.Types.ObjectId(shopId),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$netAmount' },
          platformFee: { $sum: '$platformFee' },
          count: { $sum: 1 },
        },
      },
    ]),
    WithdrawalRequest.aggregate([
      {
        $match: {
          shop: mongoose.Types.ObjectId(shopId),
          status: WITHDRAWAL_STATUS.COMPLETED,
          completedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalWithdrawn: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Wallet.findOne({ shop: shopId }),
  ])

  const orderStats = ordersDelivered[0] || { totalGross: 0, count: 0 }
  const creditStats = walletTransactions.find(t => t._id === 'credit') || { total: 0, platformFee: 0, count: 0 }
  const debitStats = walletTransactions.find(t => t._id === 'debit') || { total: 0, count: 0 }
  const withdrawalStats = withdrawals[0] || { totalWithdrawn: 0, count: 0 }

  return {
    period: { startDate, endDate },
    orders: {
      totalGross: orderStats.totalGross,
      count: orderStats.count,
    },
    credits: {
      totalNet: creditStats.total,
      totalPlatformFee: creditStats.platformFee,
      count: creditStats.count,
    },
    withdrawals: {
      total: withdrawalStats.totalWithdrawn,
      count: withdrawalStats.count,
    },
    currentWallet: {
      balance: wallet?.balance || 0,
      pendingBalance: wallet?.pendingBalance || 0,
      totalBalance: (wallet?.balance || 0) + (wallet?.pendingBalance || 0),
    },
    // Verification
    expectedBalance: creditStats.total - withdrawalStats.totalWithdrawn,
    actualBalance: (wallet?.balance || 0) + (wallet?.pendingBalance || 0),
    discrepancy: Math.abs(
      (creditStats.total - withdrawalStats.totalWithdrawn) -
      ((wallet?.balance || 0) + (wallet?.pendingBalance || 0))
    ),
  }
}
```

---

## 8. Implementation Checklist

### Phase 1: Core Changes (2-3 days)
- [ ] Update status constants
- [ ] Update Wallet model (add totalPlatformFee)
- [ ] Update WithdrawalRequest model (add audit fields)
- [ ] Update wallet repository methods
- [ ] Update wallet service methods
- [ ] Add new API endpoints
- [ ] Update validation schemas

### Phase 2: Testing (1-2 days)
- [ ] Unit tests for wallet repository
- [ ] Integration tests for withdrawal flow
- [ ] Test race conditions
- [ ] Test reconciliation report

### Phase 3: Migration (1 day)
- [ ] Write migration script for existing data
- [ ] Backup database
- [ ] Run migration
- [ ] Verify data integrity

### Phase 4: Monitoring & Notification (2-3 days)
- [ ] Add notification service
- [ ] Email templates for withdrawal events
- [ ] Admin dashboard for pending withdrawals
- [ ] Reconciliation report UI

---

## 9. Migration Script

```javascript
// scripts/migrate-wallet-pending-balance.js

/**
 * Migration: Tính toán lại pendingBalance cho các wallet có withdrawal đang pending/approved
 */
async function migrateWalletPendingBalance() {
  const withdrawals = await WithdrawalRequest.find({
    status: { $in: [WITHDRAWAL_STATUS.PENDING, WITHDRAWAL_STATUS.APPROVED] },
  })

  for (const withdrawal of withdrawals) {
    await Wallet.findOneAndUpdate(
      { shop: withdrawal.shop },
      {
        $inc: {
          balance: -withdrawal.amount,
          pendingBalance: withdrawal.amount,
        },
      }
    )
    console.log(`Migrated wallet for shop ${withdrawal.shop}`)
  }

  console.log(`Migration completed: ${withdrawals.length} wallets updated`)
}
```

---

## 10. Ưu & Nhược Điểm

### ✅ Ưu điểm:
- Tách biệt rõ ràng balance vs pendingBalance
- Audit trail đầy đủ cho mọi thao tác
- Hỗ trợ retry khi transfer failed
- Reconciliation report để đối soát
- Giảm thiểu race condition
- Tăng tính minh bạch

### ⚠️ Nhược điểm:
- Cần thời gian implement (7-10 ngày)
- Cần migration data
- Phức tạp hơn cho team maintain
- Cần training cho admin về luồng mới

---

## 11. Recommendation

**Nên implement Option 2 (Comprehensive)** vì:
1. Hệ thống thanh toán cần độ chính xác cao
2. Audit trail quan trọng cho compliance
3. Reconciliation giúp phát hiện sớm vấn đề
4. Scalable cho tương lai (VD: auto-transfer qua API ngân hàng)

**Timeline đề xuất:**
- Week 1: Phase 1 + Phase 2
- Week 2: Phase 3 + Phase 4
- Week 3: UAT và bug fixing
