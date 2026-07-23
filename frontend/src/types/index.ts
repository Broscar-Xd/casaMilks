export type Role = 'ADMIN' | 'STAFF';

export type OrderStatus = 'PENDING' | 'IN_PREPARATION' | 'READY' | 'DELIVERED' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'DEUNA' | 'PANAPAY';

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
  updatedAt?: string;
  items: KitchenSendItem[];
  order?: { id: string; tableId: string; table?: { name: string }; notes?: string | null; createdAt: string };
}

export interface KitchenSendItem {
  id: string;
  sendId: string;
  productId: string;
  quantity: number;
  product?: Product;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  branchId: string | null;
  createdAt?: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  active: boolean;
  fiscalConfig?: FiscalConfig | null;
}

export interface FiscalConfig {
  id: string;
  branchId: string;
  ruc: string;
  businessName: string;
  tradeName: string;
  receiptAuthorization: string;
  currentSequential: number;
  rimpeLegend: string;
  address: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
  branchId: string;
  image: string | null;
  active: boolean;
  requiresPreparation: boolean;
  category?: Category;
  recipes?: Recipe[];
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  minStock: number;
}

export interface Recipe {
  id: string;
  productId: string;
  ingredientId: string;
  quantity: number;
  ingredient?: Ingredient;
}

export interface Order {
  id: string;
  branchId: string;
  userId: string;
  tableId?: string;
  customerName: string | null;
  status: OrderStatus;
  total: number;
  notes: string | null;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
  user?: { id: string; name: string };
  table?: { id: string; name: string };
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: Product;
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  referenceNumber: string | null;
  cashReceived: number | null;
  cashChange: number | null;
}

export interface InventoryItem {
  id: string;
  ingredientId: string;
  branchId: string;
  quantity: number;
  ingredient: Ingredient;
}

export interface DailyClose {
  id: string;
  branchId: string;
  closeDate: string;
  totalSales: number;
  totalTransactions: number;
  averageTicket: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  deunaTotal: number;
  panapayTotal: number;
  closedAt: string | null;
  notes: string | null;
  user?: { id: string; name: string };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
