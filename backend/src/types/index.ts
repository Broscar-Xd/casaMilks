import { Request } from 'express';

/** Payload almacenado en el token JWT tras autenticación. */
export interface JwtPayload {
  userId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  branchId: string | null;
}

/** Extiende Request de Express con los datos del usuario autenticado. */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/** Envoltura estándar para respuestas exitosas. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/** Envoltura estándar para errores. */
export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

/** Resultado paginado genérico. */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type TableStatus = 'FREE' | 'OCCUPIED' | 'PENDING_PAYMENT';

export interface TableItem {
  id: string;
  branchId: string;
  name: string;
  status: TableStatus;
  active: boolean;
  orders?: Order[];
}

export interface KitchenSend {
  id: string;
  orderId: string;
  status: string;
  createdAt: string;
  items: KitchenSendItem[];
}

export interface KitchenSendItem {
  id: string;
  sendId: string;
  productId: string;
  quantity: number;
  product?: Product;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  categoryId: string;
  branchId: string;
  image?: string | null;
  active: boolean;
  requiresPreparation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  branchId: string;
  tableId: string;
  userId: string;
  customerName?: string | null;
  notes?: string | null;
  status: string;
  total: number;
  createdAt: string;
  updatedAt: string;
}
