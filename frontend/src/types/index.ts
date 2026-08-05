export type Role = 'ADMIN' | 'STAFF';

export type OrderStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

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
  comboItems?: KitchenSendCombo[];
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
  establishmentCode?: string;
  emissionPointCode?: string;
  phone?: string | null;
  email?: string | null;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  isCombo?: boolean;
  comboLines?: ComboLine[];
}

export interface ComboLine {
  id: string;
  categoryId: string;
  label: string;
  sourceCategoryId?: string | null;
  productIds?: string[];
  minSelect: number;
  maxSelect: number;
  required: boolean;
  sortOrder: number;
  sourceCategory?: Category | null;
  comboLineProducts?: ComboLineProduct[];
}

export interface ComboLineProduct {
  id: string;
  comboLineId: string;
  productId: string;
  product: ComboProduct;
}

export interface ComboProduct {
  id: string;
  name: string;
  price: number;
  categoryId?: string;
  category?: { name: string };
}

export interface OrderItemCombo {
  id: string;
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  lineLabel: string | null;
}

export interface KitchenSendCombo {
  id: string;
  kitchenSendId: string;
  productId: string;
  productName: string;
  quantity: number;
  lineLabel: string | null;
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
  taxRate?: number;
  category?: Category;
  recipes?: Recipe[];
}

export interface DigitalSignature {
  id: string;
  label: string;
  certSubject: string;
  certSerial: string;
  certRuc?: string | null;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  createdAt?: string;
}

export interface Customer {
  id: string;
  branchId: string;
  docId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  totalCost: number;
  netProfit: number;
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

export interface ElectronicReceipt {
  id: string;
  orderId: string;
  branchId: string;
  type: string;
  sequential: number;
  authorization: string;
  claveAcceso: string | null;
  numeroAutorizacion: string | null;
  ambiente: string | null;
  xmlContent: string | null;
  xmlAutorizado: string | null;
  errorMessage: string | null;
  status: string;
  createdAt: string;
  authorizedAt: string | null;
  order?: {
    id: string;
    invoiceName: string | null;
    invoiceDocId: string | null;
    total: number;
    createdAt: string;
    table: { name: string } | null;
    user: { name: string } | null;
  };
}
