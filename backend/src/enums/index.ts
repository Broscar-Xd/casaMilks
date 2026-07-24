export const Role = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
} as const;

export const OrderStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export const PaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  TRANSFER: 'TRANSFER',
  DEUNA: 'DEUNA',
  PANAPAY: 'PANAPAY',
} as const;

export const MovementType = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export const TableStatus = {
  FREE: 'FREE',
  OCCUPIED: 'OCCUPIED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
} as const;

export const KitchenSendStatus = {
  PENDING: 'PENDING',
  READY: 'READY',
} as const;
