import { useState, useEffect, useCallback } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import { formatCurrency, getPaymentMethodLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Loader2, Plus, Minus, Trash2, Receipt, ChefHat, ShoppingCart, X, Search, Banknote, CreditCard, Smartphone, Package } from 'lucide-react';
import type { TableItem, Product, Category, Order, OrderItem, ApiResponse, PaymentMethod, KitchenSend } from '@/types';

export default function POSPage() {
  const { currentBranch } = useBranch();

  /** Retorna el texto corto para mostrar en el icono de la mesa */
  const getTableIcon = (name: string) => {
    if (name.includes('VIP')) return 'VIP';
    if (name.includes('Terraza')) return `T.${name.replace(/\D/g, '')}`;
    return name.replace('Mesa ', '');
  };

  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Order data
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number; subtotal: number }>>([]);

  // Products and categories for ordering
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Payment
  const [payments, setPayments] = useState<Array<{ method: PaymentMethod; amount: number; referenceNumber: string; cashReceived: number }>>([
    { method: 'CASH', amount: 0, referenceNumber: '', cashReceived: 0 },
  ]);

  // Takeout orders
  const [takeoutOrders, setTakeoutOrders] = useState<Order[]>([]);
  const [showTakeoutModal, setShowTakeoutModal] = useState(false);
  const [isTakeout, setIsTakeout] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState('');

  const fetchTables = useCallback(async () => {
    if (!currentBranch) return;
    try {
      const res = await api.get<ApiResponse<TableItem[]>>(`/tables?branchId=${currentBranch.id}`);
      if (res.success && res.data) setTables(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [currentBranch]);

  const fetchTakeoutOrders = useCallback(async () => {
    if (!currentBranch) return;
    try {
      const res = await api.get<ApiResponse<Order[]>>(`/orders?branchId=${currentBranch.id}`);
      if (res.success && res.data) {
        setTakeoutOrders(res.data.filter(o => !o.tableId && o.status !== 'CLOSED'));
      }
    } catch { /* silent */ }
  }, [currentBranch]);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  // Polling cada 5 segundos
  useEffect(() => {
    if (!currentBranch) return;
    const interval = setInterval(fetchTables, 5000);
    return () => clearInterval(interval);
  }, [fetchTables, fetchTakeoutOrders, currentBranch]);

  const fetchProducts = async () => {
    if (!currentBranch) return;
    try {
      const [pRes, cRes] = await Promise.all([
        api.get<ApiResponse<Product[]>>(`/products?branchId=${currentBranch.id}${selectedCategory ? `&categoryId=${selectedCategory}` : ''}`),
        api.get<ApiResponse<Category[]>>('/categories'),
      ]);
      if (pRes.success && pRes.data) setProducts(pRes.data);
      if (cRes.success && cRes.data) setCategories(cRes.data);
    } catch { /* silent */ }
  };

  const openTableForOrder = (table: TableItem) => {
    setSelectedTable(table);
    setIsTakeout(false);
    setCustomerNameInput('');
    setCart([]);
    setSearch('');
    setSelectedCategory(null);
    fetchProducts();
    setShowOrderModal(true);
  };

  const openTakeoutModal = () => {
    setSelectedTable(null);
    setIsTakeout(true);
    setCustomerNameInput('');
    setCart([]);
    setSearch('');
    setSelectedCategory(null);
    fetchProducts();
    setShowOrderModal(true);
  };

  const openExistingTable = async (table: TableItem) => {
    setSelectedTable(table);
    setCart([]);
    setSearch('');
    setSelectedCategory(null);
    fetchProducts();
    try {
      const res = await api.get<ApiResponse<Order>>(`/orders/table/${table.id}`);
      if (res.success && res.data) setCurrentOrder(res.data);
      else setCurrentOrder(null);
    } catch { setCurrentOrder(null); }
    setShowAddItemsModal(true);
  };

  const openCloseTable = async (table: TableItem) => {
    setSelectedTable(table);
    try {
      const res = await api.get<ApiResponse<Order>>(`/orders/table/${table.id}`);
      if (res.success && res.data) {
        setCurrentOrder(res.data);
        setPayments([{ method: 'CASH', amount: Number(res.data.total), referenceNumber: '', cashReceived: 0 }]);
      }
    } catch { /* silent */ }
    setShowCloseModal(true);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * Number(product.price) }
            : item
        );
      }
      return [...prev, { product, quantity: 1, subtotal: Number(product.price) }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity: Math.max(1, item.quantity + delta), subtotal: Math.max(1, item.quantity + delta) * Number(item.product.price) }
          : item
      ).filter(item => item.quantity > 0)
    );
  };

  const totalCart = cart.reduce((s, i) => s + i.subtotal, 0);

  const submitOrder = async () => {
    if ((!selectedTable && !isTakeout) || cart.length === 0 || !currentBranch) return;
    if (isTakeout && !customerNameInput.trim()) {
      toast.error('Nombre del cliente requerido');
      return;
    }
    setSubmitting(true);
    try {
      if (isTakeout) {
        const res = await api.post<ApiResponse<Order>>('/orders/takeout', {
          branchId: currentBranch.id,
          customerName: customerNameInput.trim(),
          items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: Number(i.product.price), subtotal: i.subtotal })),
        });
        if (res.success) {
          toast.success('Pedido para llevar enviado a cocina');
          setShowOrderModal(false);
          setCart([]);
          fetchTables();
          fetchTakeoutOrders();
        }
      } else {
        const res = await api.post<ApiResponse<Order>>('/orders', {
          tableId: selectedTable!.id,
          branchId: currentBranch.id,
          items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: Number(i.product.price), subtotal: i.subtotal })),
        });
        if (res.success) {
          toast.success('Pedido enviado a cocina');
          setShowOrderModal(false);
          setCart([]);
          fetchTables();
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear pedido');
    } finally { setSubmitting(false); }
  };

  const submitAddItems = async () => {
    if (!currentOrder || cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await api.post<ApiResponse<Order>>(`/orders/${currentOrder.id}/items`, {
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: Number(i.product.price), subtotal: i.subtotal })),
      });
      if (res.success) {
        toast.success('Productos agregados y enviados a cocina');
        setShowAddItemsModal(false);
        setCart([]);
        fetchTables();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al agregar productos');
    } finally { setSubmitting(false); }
  };

  const submitClose = async () => {
    if (!currentOrder || !selectedTable) return;
    const paymentTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    if (Math.abs(paymentTotal - Number(currentOrder.total)) > 0.01) {
      toast.error('El total de los pagos debe coincidir con el total');
      return;
    }
    for (const p of payments) {
      if (p.method !== 'CASH' && !p.referenceNumber) {
        toast.error(`N° de comprobante requerido para ${getPaymentMethodLabel(p.method)}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await api.post<ApiResponse<Order>>(`/orders/${currentOrder.id}/close`, {
        payments: payments.map(p => ({
          method: p.method, amount: Number(p.amount),
          referenceNumber: p.method !== 'CASH' ? p.referenceNumber : undefined,
          cashReceived: p.method === 'CASH' ? p.cashReceived || 0 : undefined,
          cashChange: p.method === 'CASH' ? Math.max(0, (p.cashReceived || 0) - p.amount) : undefined,
        })),
      });
      if (res.success) {
        toast.success('Venta cerrada exitosamente');
        setShowCloseModal(false);
        fetchTables();
        if (res.data) printReceipt(res.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar venta');
    } finally { setSubmitting(false); }
  };

  const printReceipt = (order: Order) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const itemsHtml = order.items.map(item => `
      <tr><td style="text-align:left">${item.product?.name || 'Producto'}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">$${Number(item.unitPrice).toFixed(2)}</td>
      <td style="text-align:right">$${Number(item.subtotal).toFixed(2)}</td></tr>`
    ).join('');
    const payHtml = (order.payments || []).map(p =>
      `<tr><td style="text-align:left">${getPaymentMethodLabel(p.method)}</td><td style="text-align:right">$${Number(p.amount).toFixed(2)}</td></tr>`
    ).join('');
    w.document.write(`
      <html><head><title>Nota de Venta - Casa Milks</title>
      <style>body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:10px}
      .header{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px}
      .header h1{margin:0;font-size:18px}.header p{margin:2px 0;font-size:11px}
      table{width:100%;border-collapse:collapse}th,td{padding:4px 2px}
      th{border-bottom:1px solid #000}.totals{margin-top:10px;border-top:1px dashed #000;padding-top:10px}
      .footer{text-align:center;margin-top:15px;font-size:10px;border-top:1px dashed #000;padding-top:10px}
      </style></head><body>
      <div class="header"><h1>CASA MILKS</h1><p>Contribuyente RIMPE Negocio Popular</p>
      <p>Latacunga - Ecuador</p><hr><p><strong>NOTA DE VENTA</strong></p>
      <p>Mesa: ${order.table?.name || '—'}</p>
      <p>${new Date(order.createdAt).toLocaleString('es-EC')}</p></div>
      <table><thead><tr><th>Producto</th><th>Cant</th><th>P.U.</th><th>Subtotal</th></tr></thead>
      <tbody>${itemsHtml}</tbody></table>
      <div class="totals"><table><tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>$${Number(order.total).toFixed(2)}</strong></td></tr></table>
      ${payHtml ? `<table style="margin-top:5px"><tr><th colspan="2">Formas de Pago</th></tr>${payHtml}</table>` : ''}</div>
      <div class="footer"><p>¡Gracias por tu visita!</p><p>Casa Milks - Latacunga</p></div>
      <script>window.print();window.close();</script></body></html>`);
    w.document.close();
  };

  const paymentTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  if (!currentBranch) return <div className="flex h-64 items-center justify-center"><p className="text-gray-500">Selecciona un local</p></div>;
  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <div className="flex items-center justify-between mb-4">
        <button onClick={openTakeoutModal} className="btn-primary mb-4 w-full sm:w-auto">
          <Package size={18} /> Nuevo Pedido para llevar
        </button>
        <h1 className="text-lg font-semibold text-surface-900">Mapa de Mesas</h1>
        <div className="flex items-center gap-3">
          <StatusLegend color="bg-emerald-500" label="Libre" />
          <StatusLegend color="bg-amber-500" label="Ocupada" />
          <StatusLegend color="bg-red-500" label="Pendiente" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {tables.map((table) => {
            return (
              <div key={table.id}>
                {table.status === 'FREE' && (
                  <button onClick={() => openTableForOrder(table)} className={`group relative rounded-2xl bg-white shadow-soft hover:shadow-elevated border border-surface-200/80 hover:border-brand-300 hover:-translate-y-0.5 p-4 flex flex-col items-center gap-2.5 w-full transition-all duration-200 active:scale-[0.97] cursor-pointer`}>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center text-emerald-600 font-semibold text-sm shadow-soft group-hover:shadow-md group-hover:scale-105 transition-all">
                      {getTableIcon(table.name)}
                    </div>
                    <span className="text-sm font-semibold text-surface-800">{table.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">Libre</span>
                    <span className="text-[11px] text-surface-400 group-hover:text-surface-500 transition-colors">Tocar para pedir</span>
                  </button>
                )}
                {table.status === 'OCCUPIED' && (
                  <div className="relative rounded-2xl bg-white shadow-soft border border-surface-200/80 border-t-2 border-t-amber-400 p-4 flex flex-col items-center gap-2.5 w-full">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center text-amber-600 font-semibold text-sm shadow-soft">
                      {getTableIcon(table.name)}
                    </div>
                    <span className="text-sm font-semibold text-surface-800">{table.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium">Ocupada</span>
                    <div className="flex gap-2 mt-1 w-full">
                      <button onClick={() => openExistingTable(table)} className="btn-secondary text-xs flex-1 py-1.5 px-2"><ShoppingCart size={13} /> Add</button>
                      <button onClick={() => openCloseTable(table)} className="btn-primary text-xs flex-1 py-1.5 px-2"><Receipt size={13} /> Cobrar</button>
                    </div>
                  </div>
                )}
                {table.status === 'PENDING_PAYMENT' && (
                  <button onClick={() => openCloseTable(table)} className={`group relative rounded-2xl bg-white shadow-soft hover:shadow-elevated border border-surface-200/80 hover:border-red-300 hover:-translate-y-0.5 p-4 flex flex-col items-center gap-2.5 w-full transition-all duration-200 active:scale-[0.97] cursor-pointer`}>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center text-red-600 font-semibold text-sm shadow-soft group-hover:shadow-md group-hover:scale-105 transition-all">
                      {getTableIcon(table.name)}
                    </div>
                    <span className="text-sm font-semibold text-surface-800">{table.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-medium">Pendiente</span>
                    <span className="text-[11px] text-surface-400 group-hover:text-surface-500 transition-colors">Tocar para cobrar</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {takeoutOrders.length > 0 && (
        <>
          <div className="divider" />
          <h2 className="text-sm font-semibold text-surface-900 mb-3">Pedidos para llevar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
            {takeoutOrders.map((order) => (
              <div key={order.id} className="relative rounded-2xl bg-white shadow-soft border border-surface-200/80 p-4 flex flex-col items-center gap-2.5 w-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm shadow-soft">
                  <Package size={20} />
                </div>
                <span className="text-sm font-semibold text-surface-800">{order.customerName || 'Cliente'}</span>
                <span className="text-xs text-surface-400">{formatCurrency(Number(order.total))}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium">En preparación</span>
                <div className="flex gap-2 mt-1 w-full">
                  <button onClick={async () => {
                    const res = await api.get<ApiResponse<Order>>(`/orders/${order.id}`);
                    if (res.success && res.data) {
                      setCurrentOrder(res.data);
                      setShowAddItemsModal(true);
                      fetchProducts();
                    }
                  }} className="btn-secondary text-xs flex-1 py-1.5 px-2"><ShoppingCart size={13} /> Add</button>
                  <button onClick={async () => {
                    const res = await api.get<ApiResponse<Order>>(`/orders/${order.id}`);
                    if (res.success && res.data) {
                      setCurrentOrder(res.data);
                      setPayments([{ method: 'CASH', amount: Number(res.data.total), referenceNumber: '', cashReceived: 0 }]);
                      setShowCloseModal(true);
                    }
                  }} className="btn-primary text-xs flex-1 py-1.5 px-2"><Receipt size={13} /> Cobrar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MODAL: Nuevo Pedido */}
      {showOrderModal && (
        <TableModal title={isTakeout ? 'Pedido para llevar' : `${selectedTable?.name} - Nuevo Pedido`} onClose={() => setShowOrderModal(false)}>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 h-full">
            <div className="flex-1 flex flex-col min-w-0">
              {isTakeout && (
                <div className="mb-3">
                  <label className="label">Nombre del cliente *</label>
                  <input type="text" className="input" placeholder="Nombre del cliente" value={customerNameInput}
                    onChange={e => setCustomerNameInput(e.target.value)} required />
                </div>
              )}
              <input type="text" placeholder="Buscar producto..." className="input mb-2 py-2 text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
              <div className="flex gap-1.5 overflow-x-auto pb-2">
                <button onClick={() => setSelectedCategory(null)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${!selectedCategory ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Todos</button>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${selectedCategory === cat.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{cat.name}</button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto min-w-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(product => (
                    <button key={product.id} onClick={() => addToCart(product)}
                      className="card p-2 text-left hover:border-brand-300 hover:shadow-sm active:scale-95 flex flex-col">
                      <div className="flex items-center justify-center rounded-lg bg-brand-50 mb-1 h-12"><span className="text-xl">🥪</span></div>
                      <h3 className="text-xs font-medium text-gray-900 leading-tight">{product.name}</h3>
                      <p className="text-xs font-bold text-brand-600">{formatCurrency(Number(product.price))}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-full sm:w-72 flex flex-col bg-gray-50 rounded-xl border shrink-0 max-h-64 sm:max-h-none">
              <div className="border-b px-3 py-2"><h3 className="text-sm font-semibold">Pedido</h3></div>
              <div className="flex-1 overflow-y-auto px-3 py-1">
                {cart.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">Selecciona productos</p> : (
                  <div className="space-y-1.5">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center gap-2 bg-white rounded-lg p-1.5 text-xs">
                        <div className="flex-1 min-w-0"><p className="truncate">{item.product.name}</p></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.product.id, -1)} className="flex h-6 w-6 items-center justify-center rounded bg-gray-100"><Minus size={12} /></button>
                          <span className="w-6 text-center font-medium">{item.quantity}</span>
                          <button onClick={() => updateQty(item.product.id, 1)} className="flex h-6 w-6 items-center justify-center rounded bg-gray-100"><Plus size={12} /></button>
                        </div>
                        <span className="w-16 text-right font-medium">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t px-3 py-2 space-y-2">
                <div className="flex justify-between text-sm"><span>Total</span><span className="font-bold">{formatCurrency(totalCart)}</span></div>
                <button onClick={submitOrder} disabled={cart.length === 0 || submitting} className="btn-primary w-full py-2 text-sm">
                  {submitting ? 'Enviando...' : 'Enviar a Cocina'}
                </button>
              </div>
            </div>
          </div>
        </TableModal>
      )}

      {/* MODAL: Agregar productos */}
      {showAddItemsModal && (
        <TableModal title={`${selectedTable?.name} - Agregar Productos`} onClose={() => setShowAddItemsModal(false)}>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 h-full">
            <div className="flex-1 flex flex-col min-w-0">
              <div className="mb-2">
                <h3 className="text-sm font-semibold mb-1">Productos actuales</h3>
                <div className="bg-gray-50 rounded-lg p-2 text-xs space-y-1 max-h-24 overflow-y-auto">
                  {currentOrder?.items?.map(item => (
                    <div key={item.id} className="flex justify-between"><span>{item.product?.name} x{item.quantity}</span><span>{formatCurrency(item.subtotal)}</span></div>
                  ))}
                  {(!currentOrder?.items || currentOrder.items.length === 0) && <p className="text-gray-400">Sin productos</p>}
                </div>
              </div>
              <input type="text" placeholder="Buscar producto..." className="input mb-2 py-2 text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(product => (
                    <button key={product.id} onClick={() => addToCart(product)}
                      className="card p-2 text-left hover:border-brand-300 flex flex-col">
                      <div className="flex items-center justify-center rounded-lg bg-brand-50 mb-1 h-12"><span className="text-xl">🥪</span></div>
                      <h3 className="text-xs font-medium">{product.name}</h3>
                      <p className="text-xs font-bold text-brand-600">{formatCurrency(Number(product.price))}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-full sm:w-72 flex flex-col bg-gray-50 rounded-xl border shrink-0 max-h-64 sm:max-h-none">
              <div className="border-b px-3 py-2"><h3 className="text-sm font-semibold">Nuevos productos</h3></div>
              <div className="flex-1 overflow-y-auto px-3 py-1">
                {cart.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">Selecciona productos</p> : (
                  <div className="space-y-1.5">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center gap-2 bg-white rounded-lg p-1.5 text-xs">
                        <div className="flex-1 min-w-0"><p className="truncate">{item.product.name}</p></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.product.id, -1)} className="flex h-6 w-6 items-center justify-center rounded bg-gray-100"><Minus size={12} /></button>
                          <span className="w-6 text-center font-medium">{item.quantity}</span>
                          <button onClick={() => updateQty(item.product.id, 1)} className="flex h-6 w-6 items-center justify-center rounded bg-gray-100"><Plus size={12} /></button>
                        </div>
                        <span className="w-16 text-right font-medium">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t px-3 py-2">
                <button onClick={submitAddItems} disabled={cart.length === 0 || submitting} className="btn-primary w-full py-2 text-sm">
                  {submitting ? 'Enviando...' : 'Agregar y enviar a Cocina'}
                </button>
              </div>
            </div>
          </div>
        </TableModal>
      )}

      {/* MODAL: Cerrar y Cobrar */}
      {showCloseModal && currentOrder && (
        <TableModal title={`${selectedTable?.name} - Cerrar Cuenta`} onClose={() => setShowCloseModal(false)}>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 h-full">
            {/* Columna izquierda — Productos consumidos */}
            <div className="flex-1 flex flex-col min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Productos consumidos</h4>
              <div className="flex-1 overflow-y-auto bg-gray-50/70 rounded-xl p-4 space-y-2">
                {currentOrder.items?.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 shadow-soft">
                    <span className="text-sm text-gray-700">
                      {item.product?.name} <span className="text-gray-400">x{item.quantity}</span>
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-center">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-brand-600">{formatCurrency(Number(currentOrder.total))}</span>
                </div>
              </div>
            </div>

            {/* Columna derecha — Formas de Pago */}
            <div className="w-full sm:w-[420px] flex flex-col shrink-0">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Formas de Pago</h4>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {payments.map((payment, idx) => (
                  <div key={idx} className={`rounded-xl border p-4 space-y-3 shadow-soft ${
                    payment.method !== 'CASH' && !payment.referenceNumber && payment.amount > 0 ? 'border-red-300 bg-red-50/30' : 
                    payment.method !== 'CASH' && payment.referenceNumber ? 'border-emerald-300 bg-emerald-50/30' :
                    'border-gray-200/80 bg-white'
                  }`}>
                    <div className="flex items-center gap-2">
                      <select value={payment.method} onChange={e => {
                        const next = [...payments]; next[idx] = { ...next[idx], method: e.target.value as PaymentMethod, referenceNumber: '' }; setPayments(next);
                      }} className="input text-sm flex-1">
                        <option value="CASH">Efectivo</option>
                        <option value="CARD">Tarjeta</option>
                        <option value="TRANSFER">Transferencia</option>
                        <option value="DEUNA">Deuna</option>
                        <option value="PANAPAY">PanaPay</option>
                      </select>
                      <input type="number" step="0.01" className="input w-28 text-sm" placeholder="Monto" value={payment.amount || ''}
                        onChange={e => { const next = [...payments]; next[idx].amount = parseFloat(e.target.value) || 0; setPayments(next); }} />
                      {payments.length > 1 && (
                        <button onClick={() => setPayments(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 transition-colors p-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    {payment.method !== 'CASH' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-500">N° de comprobante</label>
                          {payment.amount > 0 && !payment.referenceNumber && (
                            <span className="text-xs text-red-500 font-medium">Requerido</span>
                          )}
                        </div>
                        <input type="text" className={`input text-sm ${payment.amount > 0 && !payment.referenceNumber ? 'border-red-400 focus:ring-red-500/10' : ''}`}
                          placeholder="N° de comprobante" value={payment.referenceNumber}
                          onChange={e => { const next = [...payments]; next[idx].referenceNumber = e.target.value; setPayments(next); }} />
                      </div>
                    )}
                    {payment.method === 'CASH' && (
                      <div>
                        <input type="number" step="0.01" className={`input text-sm ${payment.amount > 0 && Number(payment.cashReceived || 0) < payment.amount ? 'border-amber-400' : ''}`}
                          placeholder="Monto recibido" value={payment.cashReceived || ''}
                          onChange={e => { const next = [...payments]; next[idx].cashReceived = parseFloat(e.target.value) || 0; setPayments(next); }} />
                        {Number(payment.cashReceived || 0) > 0 && (
                          <div className="mt-1 text-xs">
                            {Number(payment.cashReceived) >= payment.amount ? (
                              <span className="text-emerald-600 font-medium">Cambio: {formatCurrency(Number(payment.cashReceived) - payment.amount)}</span>
                            ) : (
                              <span className="text-amber-600 font-medium">Faltan: {formatCurrency(payment.amount - Number(payment.cashReceived))}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setPayments(prev => [...prev, { method: 'CASH', amount: 0, referenceNumber: '', cashReceived: 0 }])}
                className="btn-secondary w-full text-sm mt-3">+ Agregar forma de pago</button>

              <div className="rounded-xl bg-gray-50 p-3 space-y-1.5 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total del pedido:</span>
                  <span className="font-semibold">{formatCurrency(Number(currentOrder.total))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total pagos:</span>
                  <span className={`font-semibold ${Math.abs(Number(currentOrder.total) - paymentTotal) < 0.01 && paymentTotal > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(paymentTotal)}
                  </span>
                </div>
                {Math.abs(Number(currentOrder.total) - paymentTotal) > 0.01 && (
                  <div className="flex justify-between text-xs text-red-500 font-medium">
                    <span>Diferencia:</span>
                    <span>{formatCurrency(Math.abs(Number(currentOrder.total) - paymentTotal))}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowCloseModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={submitClose} disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Procesando...' : 'Cobrar y Cerrar'}
                </button>
              </div>
            </div>
          </div>
        </TableModal>
      )}
    </div>
  );
}

function StatusLegend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-surface-200/60 text-[11px] font-medium text-surface-500"><div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`} />{label}</div>;
}

function TableModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay p-2 sm:p-4">
      <div className="w-full max-w-5xl h-[90vh] sm:h-[85vh] modal-content flex flex-col">
        <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-surface-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-xl hover:bg-surface-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
