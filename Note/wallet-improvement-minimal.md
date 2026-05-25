# Wallet Flow - Cải Tiến Tối Thiểu

## 1. Thêm Minimum Withdrawal Amount

```javascript
// src/constants/wallet.constant.js
export const WALLET_CONSTANTS = {
  MIN_WITHDRAWAL_AMOUNT: 50000, // 50k VND
  MAX_WITHDRAWAL_AMOUNT: 50000000, // 50M VND
  PLATFORM_FEE_RATE: 0.05, // 5%
}
```

## 2. Validation trong requestWithdrawal

```javascript
// src/services/wallet/wallet.service.js
import { WALLET_CONSTANTS } from '../../constants/wallet.constant.js'

export const requestWithdrawal = async (shopId, userContext, payload) => {
  // Validate amount
  if (payload.amount < WALLET_CONSTANTS.MIN_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      `Số tiền rút tối thiểu là ${WALLET_CONSTANTS.MIN_WITHDRAWAL_AMOUNT.toLocaleString('vi-VN')} VNĐ`,
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WALLET.AMOUNT_TOO_LOW
    )
  }

  if (payload.amount > WALLET_CONSTANTS.MAX_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      `Số tiền rút tối đa là ${WALLET_CONSTANTS.MAX_WITHDRAWAL_AMOUNT.toLocaleString('vi-VN')} VNĐ`,
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WALLET.AMOUNT_TOO_HIGH
    )
  }

  // ... rest of code
}
```

## 3. Thêm Audit Fields vào WithdrawalRequest

```javascript
// src/models/withdrawal-request.model.js
const withdrawalRequestSchema = new mongoose.Schema({
  // ... existing fields
  
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
  // completedAt already exists
  
  // Thêm proof of transfer
  transferProof: {
    transactionId: { type: String, default: '' },
    transferDate: { type: Date, default: null },
    note: { type: String, default: '' },
  },
})
```

## 4. Update completeWithdrawal Service

```javascript
export const completeWithdrawal = async (withdrawalId, userContext, payload) => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.APPROVED) {
    throw new AppError(
      'Lệnh rút tiền chưa được duyệt',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WITHDRAWAL.INVALID_STATUS
    )
  }

  const shopId = request.shop?._id || request.shop
  await walletRepo.completeWithdrawal(shopId, request.amount)

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
      transferProof: payload.transferProof || {},
    },
  })

  return withdrawalRepo.updateById(withdrawalId, {
    status: WITHDRAWAL_STATUS.COMPLETED,
    adminNote: payload.adminNote || '',
    completedBy: userContext._id,
    completedAt: new Date(),
    transferProof: payload.transferProof || {},
  })
}
```

## 5. Thêm Error Constants

```javascript
// src/constants/error.constant.js
export const WALLET = {
  // ... existing errors
  AMOUNT_TOO_LOW: 'WALLET_AMOUNT_TOO_LOW',
  AMOUNT_TOO_HIGH: 'WALLET_AMOUNT_TOO_HIGH',
}
```

## 6. Validation Schema cho Complete Withdrawal

```javascript
// src/validations/wallet.validation.js
export const completeWithdrawalSchema = Joi.object({
  adminNote: Joi.string().max(500).allow('').optional(),
  transferProof: Joi.object({
    transactionId: Joi.string().max(100).required(),
    transferDate: Joi.date().required(),
    note: Joi.string().max(500).allow('').optional(),
  }).required(),
})
```

---

## Ưu điểm:
- ✅ Implement nhanh (1-2 giờ)
- ✅ Không thay đổi luồng hiện tại
- ✅ Tăng tính minh bạch và audit trail
- ✅ Giảm thiểu lỗi nhập liệu

## Nhược điểm:
- ⚠️ Vẫn chưa giải quyết vấn đề pendingBalance
- ⚠️ Chưa có notification
- ⚠️ Chưa có reconciliation report
