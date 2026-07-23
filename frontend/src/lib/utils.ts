import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Formatea un número como moneda en dólares.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Retorna el color CSS correspondiente al estado de un pedido.
 */
export function getOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'badge-pending',
    IN_PREPARATION: 'badge-preparation',
    READY: 'badge-ready',
    DELIVERED: 'badge-delivered',
    CANCELLED: 'badge-cancelled',
  };
  return colors[status] || 'badge-pending';
}

/**
 * Traduce el estado de un pedido a español.
 */
export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    IN_PREPARATION: 'En preparación',
    READY: 'Listo',
    DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado',
  };
  return labels[status] || status;
}

/**
 * Traduce el método de pago a español.
 */
export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    DEUNA: 'Deuna',
    PANAPAY: 'PanaPay',
  };
  return labels[method] || method;
}
