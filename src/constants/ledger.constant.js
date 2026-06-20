export const PLATFORM_WALLET_KEYS = {
  CLEARING: 'platform_clearing_wallet',
  REVENUE: 'platform_revenue_wallet',
}

export const PLATFORM_WALLET_KEY_ENUM = Object.values(PLATFORM_WALLET_KEYS)

export const LEDGER_TRANSACTION_TYPE = {
  ORDER_PAYMENT_SETTLEMENT: 'order_payment_settlement',
  REFUND_REVERSAL: 'refund_reversal',
}

export const LEDGER_TRANSACTION_TYPE_ENUM = Object.values(LEDGER_TRANSACTION_TYPE)

export const LEDGER_REFERENCE_TYPE = {
  ORDER: 'order',
}

export const LEDGER_REFERENCE_TYPE_ENUM = Object.values(LEDGER_REFERENCE_TYPE)

export const LEDGER_ENTRY_DIRECTION = {
  CREDIT: 'credit',
  DEBIT: 'debit',
}

export const LEDGER_ENTRY_DIRECTION_ENUM = Object.values(LEDGER_ENTRY_DIRECTION)
