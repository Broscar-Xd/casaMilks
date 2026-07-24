import { Role, OrderStatus, PaymentMethod, MovementType } from '@prisma/client';

export { Role, OrderStatus, PaymentMethod, MovementType };

export const TableStatus = {
  FREE: 'FREE',
  OCCUPIED: 'OCCUPIED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
} as const;

export const KitchenSendStatus = {
  PENDING: 'PENDING',
  READY: 'READY',
} as const;
