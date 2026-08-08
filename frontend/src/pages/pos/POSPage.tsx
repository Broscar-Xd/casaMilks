import { useState, useEffect, useCallback } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import { formatCurrency, getPaymentMethodLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Loader2, Plus, Minus, Trash2, Receipt, ChefHat, ShoppingCart, X, Search, Banknote, CreditCard, Smartphone, Package, Layers, CheckCircle, XCircle, FileText, ChevronRight, ChevronLeft } from 'lucide-react';
import type { TableItem, Product, Category, Order, OrderItem, ApiResponse, PaymentMethod, KitchenSend, ComboLine, Customer } from '@/types';
import { hasKitchenPending } from '@/types';

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
  const [cart, setCart] = useState<Array<{
    product: Product;
    quantity: number;
    subtotal: number;
    comboSelections?: Array<{ productId: string; productName: string; lineLabel: string }>;
    // Identificador único por instancia (necesario porque un mismo combo puede
    // agregarse varias veces con selecciones DIFERENTES)
    uid: string;
  }>>([]);

  // Combo selection
  const [showComboModal, setShowComboModal] = useState(false);
  const [comboProduct, setComboProduct] = useState<Product | null>(null);
  const [comboLines, setComboLines] = useState<ComboLine[]>([]);
  const [comboSelections, setComboSelections] = useState<Record<string, string[]>>({});

  // Products and categories for ordering
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Payment
  const [payments, setPayments] = useState<Array<{ method: PaymentMethod; amount: number; referenceNumber: string; cashReceived: number }>>([]);

  // Cocina pendiente: bloquea el cobro si hay items sin preparar
  const [kitchenPending, setKitchenPending] = useState(false);

  // Invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceOrderRef, setInvoiceOrderRef] = useState<any>(null);
  const [emittingInvoice, setEmittingInvoice] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<{ claveAcceso?: string; numeroAutorizacion?: string; estado?: string; mensajes?: Array<{ identificador: string; mensaje: string; informacionAdicional?: string }>; emailEnviado?: boolean; emailError?: string } | null>(null);
  const [invoiceData, setInvoiceData] = useState({
    invoiceName: '',
    invoiceDocId: '',
    invoiceEmail: '',
    invoicePhone: '',
    invoiceAddress: 'Latacunga',
  });
  // Sugerencias de clientes guardados (autocompletar facturas)
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);

  /** Detección del tipo de documento: Cédula (10), RUC (13), otro */
  const getDocType = (doc: string) => {
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 10) return 'Cédula';
    if (clean.length === 13) return 'RUC';
    return clean.length > 0 ? 'Pasaporte / Otro' : '';
  };

  /** Busca clientes guardados al escribir el documento y autocompleta si hay match exacto */
  const handleDocIdChange = async (docId: string) => {
    const clean = docId.replace(/\D/g, '').slice(0, 13);
    setInvoiceData((d) => ({ ...d, invoiceDocId: clean }));
    if (!currentBranch || clean.length < 6) {
      setCustomerSuggestions([]);
      return;
    }
    try {
      const res = await api.get<ApiResponse<Customer[]>>(`/customers?branchId=${currentBranch.id}&search=${clean}`);
      if (res.success && res.data) {
        setCustomerSuggestions(res.data);
        const exact = res.data.find((c) => c.docId === clean);
        if (exact) {
          setInvoiceData((d) => ({
            ...d,
            invoiceDocId: clean,
            invoiceName: exact.name,
            invoiceEmail: exact.email || '',
            invoicePhone: exact.phone || '',
            invoiceAddress: exact.address || 'Latacunga',
          }));
          setCustomerSuggestions([]);
        }
      }
    } catch {
      /* silencioso */
    }
  };

  /** Aplica un cliente sugerido al formulario */
  const applyCustomer = (c: Customer) => {
    setInvoiceData((d) => ({
      ...d,
      invoiceDocId: c.docId,
      invoiceName: c.name,
      invoiceEmail: c.email || '',
      invoicePhone: c.phone || '',
      invoiceAddress: c.address || 'Latacunga',
    }));
    setCustomerSuggestions([]);
  };

  /** Guarda el cliente para futuras facturas (upsert por docId) */
  const saveCustomer = async () => {
    if (!currentBranch || !invoiceData.invoiceDocId.trim() || !invoiceData.invoiceName.trim()) return;
    try {
      await api.post('/customers', {
        branchId: currentBranch.id,
        docId: invoiceData.invoiceDocId.trim(),
        name: invoiceData.invoiceName.trim(),
        email: invoiceData.invoiceEmail.trim(),
        phone: invoiceData.invoicePhone.trim(),
        address: invoiceData.invoiceAddress.trim(),
      });
    } catch {
      /* silencioso: guardar cliente es opcional */
    }
  };

  // Takeout orders
  const [takeoutOrders, setTakeoutOrders] = useState<Order[]>([]);
  const [showTakeoutModal, setShowTakeoutModal] = useState(false);
  const [isTakeout, setIsTakeout] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

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

  useEffect(() => { fetchTables(); fetchTakeoutOrders(); }, [fetchTables, fetchTakeoutOrders]);

  // Polling cada 5 segundos
  useEffect(() => {
    if (!currentBranch) return;
    const interval = setInterval(() => {
      fetchTables();
      fetchTakeoutOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTables, fetchTakeoutOrders, currentBranch]);

  const fetchProducts = async () => {
    if (!currentBranch) return;
    try {
      const [pRes, cRes] = await Promise.all([
        api.get<ApiResponse<Product[]>>(`/products?branchId=${currentBranch.id}`),
        api.get<ApiResponse<Category[]>>('/categories'),
      ]);
      if (pRes.success && pRes.data) setProducts(pRes.data);
      if (cRes.success && cRes.data) setCategories(cRes.data);
    } catch { /* silent */ }
  };

  /** Productos filtrados localmente por categoría (sin llamada API) */
  const filteredProducts = products.filter(
    (p) => (!selectedCategory || p.categoryId === selectedCategory) && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openTableForOrder = (table: TableItem) => {
    setSelectedTable(table);
    setIsTakeout(false);
    setCustomerNameInput('');
    setNotesInput('');
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
    setNotesInput('');
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
        setPayments([]);
        setKitchenPending(hasKitchenPending(res.data));
      }
    } catch { /* silent */ }
    setShowCloseModal(true);
  };

  // Mientras el modal de cierre esté abierto, refresca el estado de cocina
  // cada 4s para desbloquear el cobro cuando la cocina marque todo como listo.
  useEffect(() => {
    if (!showCloseModal || !currentOrder) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get<ApiResponse<Order>>(`/orders/table/${currentOrder.tableId}`);
        if (res.success && res.data) {
          setCurrentOrder(res.data);
          setKitchenPending(hasKitchenPending(res.data));
        }
      } catch { /* silent */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [showCloseModal, currentOrder?.id, currentOrder?.tableId]);

  const openComboSelector = async (product: Product) => {
    setComboProduct(product);
    setComboSelections({});
    try {
      const categoryId = product.categoryId;
      const res = await api.get<ApiResponse<ComboLine[]>>(`/categories/${categoryId}/combos`);
      if (res.success && res.data) {
        setComboLines(res.data);
        // Init selections
        const init: Record<string, string[]> = {};
        res.data.forEach(line => { init[line.id] = []; });
        setComboSelections(init);
        setShowComboModal(true);
      }
    } catch {
      toast.error('Error al cargar opciones del combo');
    }
  };

  const addToCart = (product: Product) => {
    // If product category is combo, open combo selector instead
    if (product.category?.isCombo) {
      openComboSelector(product);
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * Number(product.price) }
            : item
        );
      }
      return [...prev, { product, quantity: 1, subtotal: Number(product.price), uid: crypto.randomUUID() }];
    });
  };

  const addComboToCart = () => {
    if (!comboProduct) return;
    // Validate selections
    for (const line of comboLines) {
      const selected = comboSelections[line.id] || [];
      if (line.required && selected.length < line.minSelect) {
        toast.error(`Selecciona al menos ${line.minSelect} opción en "${line.label}"`);
        return;
      }
      if (selected.length > line.maxSelect) {
        toast.error(`Máximo ${line.maxSelect} opciones en "${line.label}"`);
        return;
      }
    }
    const selections: Array<{ productId: string; productName: string; lineLabel: string }> = [];
    for (const line of comboLines) {
      const selected = comboSelections[line.id] || [];
      for (const productId of selected) {
        const lineProduct = line.comboLineProducts?.find(clp => clp.productId === productId)?.product;
        if (lineProduct) {
          selections.push({ productId: lineProduct.id, productName: lineProduct.name, lineLabel: line.label });
        }
      }
    }
    setCart(prev => [
      // Cada combo agregado es un item SEPARADO (uid único): dos desayunos
      // pueden tener selecciones diferentes, no deben agruparse.
      ...prev,
      { product: comboProduct, quantity: 1, subtotal: Number(comboProduct.price), comboSelections: selections, uid: crypto.randomUUID() },
    ]);
    setShowComboModal(false);
    setComboProduct(null);
    toast.success(`${comboProduct.name} agregado con opciones`);
  };

  const toggleComboSelection = (lineId: string, productId: string, maxSelect: number) => {
    setComboSelections(prev => {
      const current = prev[lineId] || [];
      if (current.includes(productId)) {
        return { ...prev, [lineId]: current.filter(id => id !== productId) };
      }
      if (current.length >= maxSelect) {
        toast.error(`Máximo ${maxSelect} selecciones`);
        return prev;
      }
      return { ...prev, [lineId]: [...current, productId] };
    });
  };

  const updateQty = (uid: string, delta: number) => {
    setCart(prev =>
      prev.map(item =>
        item.uid === uid
          ? { ...item, quantity: Math.max(1, item.quantity + delta), subtotal: Math.max(1, item.quantity + delta) * Number(item.product.price) }
          : item
      ).filter(item => item.quantity > 0)
    );
  };

  const removeFromCart = (uid: string) => {
    setCart(prev => prev.filter(item => item.uid !== uid));
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
          notes: notesInput.trim() || undefined,
          items: cart.map(i => ({
            productId: i.product.id,
            quantity: i.quantity,
            unitPrice: Number(i.product.price),
            subtotal: i.subtotal,
            comboSelections: i.comboSelections,
          })),
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
          notes: notesInput.trim() || undefined,
          items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: Number(i.product.price), subtotal: i.subtotal, comboSelections: i.comboSelections })),
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
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: Number(i.product.price), subtotal: i.subtotal, comboSelections: i.comboSelections })),
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
    if (!currentOrder) return;
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
        setCurrentOrder(null);
        fetchTables();
        fetchTakeoutOrders();
        if (res.data) {
          // Store the closed order data for printing/invoice
          const closedOrder = res.data;
          // Ask if they want invoice
          setShowInvoiceForm(false);
          setInvoiceResult(null);
          setShowInvoiceModal(true);
          // Store reference for printing later
          setInvoiceOrderRef(closedOrder);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar venta');
    } finally { setSubmitting(false); }
  };

  const printReceipt = (order: any) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const itemsHtml = order.items.map((item: any) => {
      const comboHtml = (item.comboItems && item.comboItems.length > 0)
        ? item.comboItems.map((c: any) => `
          <tr><td style="text-align:left;padding-left:8px;font-size:10px">- ${c.productName}${c.quantity > 1 ? ` x${c.quantity}` : ''}</td>
          <td style="text-align:center;font-size:10px"></td>
          <td style="text-align:right;font-size:10px"></td>
          <td style="text-align:right;font-size:10px"></td></tr>`).join('')
        : '';
      return `
      <tr><td style="text-align:left">${item.product?.name || 'Producto'}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">$${Number(item.unitPrice).toFixed(2)}</td>
      <td style="text-align:right">$${Number(item.subtotal).toFixed(2)}</td></tr>
      ${comboHtml}`;
    }).join('');
    const payHtml = (order.payments || []).map((p: any) =>
      `<tr><td style="text-align:left">${getPaymentMethodLabel(p.method)}</td><td style="text-align:right">$${Number(p.amount).toFixed(2)}</td></tr>`
    ).join('');
    const hasInvoice = order.invoiceName || order.invoiceDocId;
    const invoiceBlock = hasInvoice ? `
      <div class="invoice-data">
        <p><strong>Cliente:</strong> ${order.invoiceName || ''}</p>
        <p><strong>Cédula:</strong> ${order.invoiceDocId || ''}</p>
        ${order.invoiceEmail ? `<p><strong>Email:</strong> ${order.invoiceEmail}</p>` : ''}
        ${order.invoicePhone ? `<p><strong>Teléfono:</strong> ${order.invoicePhone}</p>` : ''}
        <p><strong>Dirección:</strong> ${order.invoiceAddress || 'Latacunga'}</p>
      </div>` : '';
    w.document.write(`
      <html><head><title>Nota de Venta - Casa Milks</title>
      <style>body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:10px}
      .header{text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:10px}
      .header p{margin:1px 0;font-size:11px}
      .invoice-data{border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:10px;font-size:11px}
      .invoice-data p{margin:1px 0}
      table{width:100%;border-collapse:collapse}th,td{padding:4px 2px}
      th{border-bottom:1px solid #000}.totals{margin-top:10px;border-top:1px dashed #000;padding-top:8px}
      .footer{text-align:center;margin-top:10px;font-size:10px}
      </style></head><body>
      <div class="header">
      <p><strong>NOTA DE VENTA</strong></p>
      <p>Casa Milks</p>
      <p>Mesa: ${order.table?.name || 'Para llevar'}</p>
      ${order.customerName ? `<p>Cliente: ${order.customerName}</p>` : ''}
      <p>${new Date(order.createdAt).toLocaleString('es-EC')}</p></div>
      ${invoiceBlock}
      <table><thead><tr><th>Producto</th><th>Cant</th><th>P.U.</th><th>Subtotal</th></tr></thead>
      <tbody>${itemsHtml}</tbody></table>
      <div class="totals"><table><tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>$${Number(order.total).toFixed(2)}</strong></td></tr></table>
      ${payHtml ? `<table style="margin-top:5px"><tr><th colspan="2">Formas de Pago</th></tr>${payHtml}</table>` : ''}</div>
      <div class="footer"><p>¡Gracias por tu visita!</p></div>
      <script>window.print();window.close();</script></body></html>`);
    w.document.close();
  };

  const paymentTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  if (!currentBranch) return <div className="flex h-64 items-center justify-center"><p className="text-cocoa-300">Selecciona un local</p></div>;
  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-cocoa-500" /></div>;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header con CTA */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="page-header mb-0">
          <h1 className="page-title">Mapa de Mesas</h1>
          <p className="page-subtitle">{currentBranch.name} — {tables.length} mesas</p>
        </div>
        <button onClick={openTakeoutModal} className="btn-primary self-start sm:self-auto">
          <Package size={18} /> Pedido para llevar
        </button>
      </div>

      {/* Leyenda de estados */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <StatusLegend color="bg-emerald-400" label="Libre" />
        <StatusLegend color="bg-amber-400" label="Ocupada" />
        <StatusLegend color="bg-red-400" label="Por cobrar" />
      </div>

      {/* Grid de mesas */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {tables.map((table) => {
            return (
              <div key={table.id}>
                {table.status === 'FREE' && (
                  <button
                    onClick={() => openTableForOrder(table)}
                    className="group relative w-full overflow-hidden rounded-2xl border-2 border-emerald-200/70 bg-white p-5 flex flex-col items-center gap-2 shadow-sm shadow-cocoa-900/5 transition-all duration-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1 active:scale-[0.97] cursor-pointer"
                  >
                    {/* Barra de estado superior */}
                    <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-500" />
                    {/* Ícono de mesa */}
                    <div className="relative">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-500/30 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3">
                        {getTableIcon(table.name)}
                      </div>
                      {/* Punto de pulso */}
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                      </span>
                    </div>
                    <span className="text-sm font-bold text-cocoa-900">{table.name}</span>
                    <span className="badge-ready">Disponible</span>
                    <span className="text-[11px] font-medium text-cocoa-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200">Tocar para abrir pedido</span>
                  </button>
                )}

                {table.status === 'OCCUPIED' && (
                  <div className="relative w-full overflow-hidden rounded-2xl border-2 border-amber-200/70 bg-white p-5 flex flex-col items-center gap-2 shadow-sm shadow-cocoa-900/5">
                    <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 to-amber-500" />
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/30">
                      {getTableIcon(table.name)}
                    </div>
                    <span className="text-sm font-bold text-cocoa-900">{table.name}</span>
                    <span className="badge-pending">Ocupada</span>
                    <div className="flex gap-2 mt-1.5 w-full">
                      <button onClick={() => openExistingTable(table)} className="btn-secondary flex-1 py-1.5 px-2 text-xs"><ShoppingCart size={13} /> Agregar</button>
                      <button onClick={() => openCloseTable(table)} className="btn-primary flex-1 py-1.5 px-2 text-xs"><Receipt size={13} /> Cobrar</button>
                    </div>
                  </div>
                )}

                {table.status === 'PENDING_PAYMENT' && (
                  <button
                    onClick={() => openCloseTable(table)}
                    className="group relative w-full overflow-hidden rounded-2xl border-2 border-red-200/70 bg-gradient-to-b from-red-50/50 to-white p-5 flex flex-col items-center gap-2 shadow-sm shadow-cocoa-900/5 transition-all duration-200 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-1 active:scale-[0.97] cursor-pointer"
                  >
                    <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-400 to-red-500" />
                    <div className="relative">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-400 to-red-600 text-white font-bold text-sm shadow-md shadow-red-500/30 transition-transform duration-200 group-hover:scale-110">
                        {getTableIcon(table.name)}
                      </div>
                      {/* Alerta parpadeante */}
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                        <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500 ring-2 ring-white" />
                      </span>
                    </div>
                    <span className="text-sm font-bold text-cocoa-900">{table.name}</span>
                    <span className="badge-cancelled">Por cobrar</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-[11px] font-semibold text-white shadow-md shadow-red-500/30 group-hover:shadow-lg group-hover:scale-105 transition-all">
                      <Receipt size={12} /> Cobrar ahora
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pedidos para llevar */}
      {takeoutOrders.length > 0 && (
        <>
          <div className="divider" />
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-cocoa-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cocoa-500 to-cocoa-700 text-milk-50 shadow-sm"><Package size={14} /></span>
            Pedidos para llevar
            <span className="ml-1 rounded-full bg-cocoa-100 px-2 py-0.5 text-[11px] font-semibold text-cocoa-700">{takeoutOrders.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
            {takeoutOrders.map((order) => (
              <div key={order.id} className="relative w-full overflow-hidden rounded-2xl border-2 border-cocoa-200/70 bg-white p-5 flex flex-col items-center gap-2 shadow-sm shadow-cocoa-900/5">
                <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cocoa-500 to-cocoa-700" />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cocoa-500 to-cocoa-700 text-milk-50 shadow-md shadow-cocoa-600/30">
                  <Package size={22} />
                </div>
                <span className="text-sm font-bold text-cocoa-900 text-center leading-tight">{order.customerName || 'Cliente'}</span>
                <span className="text-sm font-bold text-cocoa-600">{formatCurrency(Number(order.total))}</span>
                <span className="badge-pending">En preparación</span>
                <div className="flex gap-2 mt-1.5 w-full">
                  <button onClick={async () => {
                    const res = await api.get<ApiResponse<Order>>(`/orders/${order.id}`);
                    if (res.success && res.data) {
                      setCurrentOrder(res.data);
                      setShowAddItemsModal(true);
                      fetchProducts();
                    }
                  }} className="btn-secondary flex-1 py-1.5 px-2 text-xs"><ShoppingCart size={13} /> Agregar</button>
                  <button onClick={async () => {
                    const res = await api.get<ApiResponse<Order>>(`/orders/${order.id}`);
                    if (res.success && res.data) {
                      setCurrentOrder(res.data);
                      setPayments([]);
                      setShowCloseModal(true);
                    }
                  }} className="btn-primary flex-1 py-1.5 px-2 text-xs"><Receipt size={13} /> Cobrar</button>
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
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {isTakeout && (
                <div className="mb-3">
                  <label className="label">Nombre del cliente *</label>
                  <input type="text" className="input" placeholder="Nombre del cliente" value={customerNameInput}
                    onChange={e => setCustomerNameInput(e.target.value)} required />
                </div>
              )}
              <div className="mb-3">
                <label className="label">Nota para cocina (opcional)</label>
                <textarea className="input py-2" rows={2} placeholder="Ej: Sin sal, bien tostado..."
                  value={notesInput} onChange={e => setNotesInput(e.target.value)} />
              </div>
              <input type="text" placeholder="Buscar producto..." className="input mb-2 py-2 text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
              <PosProductPicker
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                products={filteredProducts}
                onAddProduct={addToCart}
              />
            </div>
            <div className="w-full sm:w-72 flex flex-col bg-milk-50/80 rounded-2xl border border-milk-200/90 shrink-0 max-h-64 sm:max-h-[70vh]">
              <div className="border-b border-milk-200/70 px-4 py-2.5 shrink-0"><h3 className="text-sm font-semibold text-cocoa-900">Pedido</h3></div>
              <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
                {cart.length === 0 ? <p className="text-xs text-cocoa-300 text-center py-4">Selecciona productos</p> : (
                  <div className="space-y-1.5">
                    {cart.map(item => (
                      <div key={item.uid} className="flex items-center gap-2 bg-white rounded-xl p-2 text-xs shadow-sm shadow-cocoa-900/5 border border-milk-200/60">
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-cocoa-800">{item.product.name}</p>
                          {item.comboSelections && item.comboSelections.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.comboSelections.map((sel, si) => (
                                <span key={si} className="inline-flex items-center gap-0.5 rounded-full bg-cocoa-50 px-1.5 py-0.5 text-[9px] text-cocoa-600">
                                  {sel.productName}
                                  {item.quantity > 1 && <span className="font-bold text-cocoa-800"> x{item.quantity}</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.uid, -1)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-milk-100 text-cocoa-600 hover:bg-milk-200 transition-colors"><Minus size={12} /></button>
                          <span className="w-6 text-center font-semibold text-cocoa-800">{item.quantity}</span>
                          <button onClick={() => updateQty(item.uid, 1)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-milk-100 text-cocoa-600 hover:bg-milk-200 transition-colors"><Plus size={12} /></button>
                          <button onClick={() => removeFromCart(item.uid)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors" title="Eliminar">
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <span className="w-16 text-right font-semibold text-cocoa-700">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-milk-200/70 px-4 py-3 space-y-2 shrink-0 bg-white/60 rounded-b-2xl">
                <div className="flex justify-between text-sm"><span className="text-cocoa-500">Total</span><span className="font-bold text-cocoa-900 text-base">{formatCurrency(totalCart)}</span></div>
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
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="mb-2">
                <h3 className="text-sm font-semibold text-cocoa-900 mb-1.5">Productos actuales</h3>
                <div className="bg-milk-50/80 rounded-xl border border-milk-200/70 p-3 text-xs space-y-1.5 max-h-24 overflow-y-auto">
                  {currentOrder?.items?.map(item => (
                    <div key={item.id} className="flex justify-between text-cocoa-700 gap-2">
                      <div className="min-w-0">
                        <span>{item.product?.name} <span className="text-cocoa-400">x{item.quantity}</span></span>
                        {item.comboItems && item.comboItems.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {item.comboItems.map((c) => (
                              <span key={c.id} className="inline-flex items-center gap-0.5 rounded-full bg-cocoa-50 px-1.5 py-0.5 text-[9px] text-cocoa-600">
                                {c.productName}
                                {c.quantity > 1 && <span className="font-bold text-cocoa-800"> x{c.quantity}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-medium shrink-0">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                  {(!currentOrder?.items || currentOrder.items.length === 0) && <p className="text-cocoa-300">Sin productos</p>}
                </div>
              </div>
              <input type="text" placeholder="Buscar producto..." className="input mb-2 py-2 text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
              <PosProductPicker
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                products={filteredProducts}
                onAddProduct={addToCart}
              />
            </div>
            <div className="w-full sm:w-72 flex flex-col bg-milk-50/80 rounded-2xl border border-milk-200/90 shrink-0 max-h-64 sm:max-h-[70vh]">
              <div className="border-b border-milk-200/70 px-4 py-2.5 shrink-0"><h3 className="text-sm font-semibold text-cocoa-900">Nuevos productos</h3></div>
              <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
                {cart.length === 0 ? <p className="text-xs text-cocoa-300 text-center py-4">Selecciona productos</p> : (
                  <div className="space-y-1.5">
                    {cart.map(item => (
                      <div key={item.uid} className="flex items-center gap-2 bg-white rounded-xl p-2 text-xs shadow-sm shadow-cocoa-900/5 border border-milk-200/60">
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-cocoa-800">{item.product.name}</p>
                          {item.comboSelections && item.comboSelections.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.comboSelections.map((sel, si) => (
                                <span key={si} className="inline-flex items-center gap-0.5 rounded-full bg-cocoa-50 px-1.5 py-0.5 text-[9px] text-cocoa-600">
                                  {sel.productName}
                                  {item.quantity > 1 && <span className="font-bold text-cocoa-800"> x{item.quantity}</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.uid, -1)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-milk-100 text-cocoa-600 hover:bg-milk-200 transition-colors"><Minus size={12} /></button>
                          <span className="w-6 text-center font-semibold text-cocoa-800">{item.quantity}</span>
                          <button onClick={() => updateQty(item.uid, 1)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-milk-100 text-cocoa-600 hover:bg-milk-200 transition-colors"><Plus size={12} /></button>
                          <button onClick={() => removeFromCart(item.uid)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors" title="Eliminar">
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <span className="w-16 text-right font-semibold text-cocoa-700">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-milk-200/70 px-4 py-3 shrink-0 bg-white/60 rounded-b-2xl">
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
              <h4 className="text-sm font-semibold text-cocoa-900 mb-3">Productos consumidos</h4>
              <div className="flex-1 overflow-y-auto bg-milk-50/80 rounded-2xl border border-milk-200/70 p-4 space-y-2">
                {currentOrder.items?.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white rounded-xl px-3 py-2.5 shadow-sm shadow-cocoa-900/5 border border-milk-200/60">
                    <div className="min-w-0">
                      <span className="text-sm text-cocoa-700">
                        {item.product?.name} <span className="text-cocoa-300">x{item.quantity}</span>
                      </span>
                      {item.comboItems && item.comboItems.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.comboItems.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-0.5 rounded-full bg-cocoa-50 px-1.5 py-0.5 text-[10px] text-cocoa-600">
                              {c.productName}
                              {c.quantity > 1 && <span className="font-bold text-cocoa-800"> x{c.quantity}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-cocoa-900">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                <div className="border-t border-milk-200 pt-3 mt-3 flex justify-between items-center">
                  <span className="text-base font-bold text-cocoa-900">Total</span>
                  <span className="text-lg font-bold text-cocoa-600">{formatCurrency(Number(currentOrder.total))}</span>
                </div>
              </div>
            </div>

            {/* Columna derecha — Formas de Pago */}
            <div className="w-full sm:w-[420px] flex flex-col shrink-0">
              <h4 className="text-sm font-semibold text-cocoa-900 mb-3">Formas de Pago</h4>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {payments.map((payment, idx) => (
                  <div key={idx} className={`rounded-xl border p-4 space-y-3 shadow-sm ${
                    payment.method !== 'CASH' && !payment.referenceNumber && payment.amount > 0 ? 'border-red-300 bg-red-50/40' :
                    payment.method !== 'CASH' && payment.referenceNumber ? 'border-emerald-300 bg-emerald-50/40' :
                    'border-milk-200/90 bg-white'
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
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {payment.method !== 'CASH' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-cocoa-400">N° de comprobante</label>
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
                          <div className="mt-1.5 text-xs">
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

              <div className="rounded-xl bg-milk-50/80 border border-milk-200/70 p-3.5 space-y-1.5 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-cocoa-400">Total del pedido:</span>
                  <span className="font-semibold text-cocoa-800">{formatCurrency(Number(currentOrder.total))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cocoa-400">Total pagos:</span>
                  <span className={`font-semibold ${Math.abs(Number(currentOrder.total) - paymentTotal) < 0.01 && paymentTotal > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(paymentTotal)}
                  </span>
                </div>
                {paymentTotal === 0 && payments.length > 0 && (
                  <p className="text-xs text-amber-600 font-medium text-center pt-1">Ingresa los montos de pago</p>
                )}
                {paymentTotal > 0 && Math.abs(Number(currentOrder.total) - paymentTotal) > 0.01 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                    <p className="text-xs font-semibold text-red-700">
                      {paymentTotal < Number(currentOrder.total)
                        ? `Falta ${formatCurrency(Number(currentOrder.total) - paymentTotal)} para completar el total`
                        : `Hay un excedente de ${formatCurrency(paymentTotal - Number(currentOrder.total))}`}
                    </p>
                  </div>
                )}
              </div>
              {/* Alerta: cocina pendiente — no se puede cobrar */}
              {kitchenPending && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5">
                  <ChefHat size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Hay productos en preparación</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Espera a que la cocina marque todo como listo antes de cobrar.
                      Se actualiza automáticamente.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowCloseModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={submitClose}
                  disabled={submitting || kitchenPending || Math.abs(Number(currentOrder.total) - paymentTotal) > 0.01 || paymentTotal === 0}
                  className="btn-primary flex-1"
                  title={kitchenPending ? 'Espera a que la cocina termine' : undefined}
                >
                  {kitchenPending ? (
                    <><ChefHat size={16} /> En preparación...</>
                  ) : submitting ? 'Procesando...' : 'Cobrar y Cerrar'}
                </button>
              </div>
            </div>
          </div>
        </TableModal>
      )}

      {/* MODAL: Tipo de comprobante (Consumidor final vs Factura) */}
      {showInvoiceModal && (
        <div className="modal-overlay">
          {/* No se cierra tocando fuera — solo los botones internos cierran */}
          <div className="w-full max-w-md modal-content mx-2 sm:mx-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-milk-200/70 px-6 py-4 bg-gradient-to-r from-milk-50/60 to-transparent rounded-t-3xl">
              <h2 className="text-base font-semibold text-cocoa-900 flex items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-gradient-to-b from-cocoa-500 to-cocoa-700" />
                Tipo de comprobante
              </h2>
              {!showInvoiceForm && !invoiceResult && (
                <button onClick={() => setShowInvoiceModal(false)} className="btn-ghost p-1.5 rounded-xl hover:bg-milk-100">
                  <X size={18} />
                </button>
              )}
            </div>

            {!showInvoiceForm && !invoiceResult && (
              <div className="p-5 space-y-3">
                <p className="text-sm text-cocoa-500">¿Cómo deseas facturar esta venta?</p>

                {/* Opción 1: Consumidor final */}
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="w-full flex items-center gap-4 rounded-2xl border-2 border-milk-200 bg-white p-4 text-left transition-all duration-150 hover:border-cocoa-300 hover:shadow-md hover:-translate-y-0.5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-milk-100 text-cocoa-500">
                    <Receipt size={22} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-cocoa-900">Consumidor final</span>
                    <span className="block text-xs text-cocoa-400 mt-0.5">Cierra la venta sin factura electrónica</span>
                  </span>
                  <ChevronRight size={16} className="text-cocoa-300" />
                </button>

                {/* Opción 2: Factura electrónica */}
                <button
                  onClick={() => setShowInvoiceForm(true)}
                  className="w-full flex items-center gap-4 rounded-2xl border-2 border-cocoa-200 bg-cocoa-50/40 p-4 text-left transition-all duration-150 hover:border-cocoa-500 hover:shadow-md hover:-translate-y-0.5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cocoa-500 to-cocoa-700 text-milk-50">
                    <FileText size={22} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-cocoa-900">Factura electrónica (SRI)</span>
                    <span className="block text-xs text-cocoa-500 mt-0.5">Llena los datos del cliente y emite contra el SRI</span>
                  </span>
                  <ChevronRight size={16} className="text-cocoa-400" />
                </button>
              </div>
            )}

            {showInvoiceForm && (
              <>
                <div className="p-5 space-y-4">
                  <button
                    onClick={() => { setShowInvoiceForm(false); setInvoiceResult(null); }}
                    className="inline-flex items-center gap-1.5 text-xs text-cocoa-400 hover:text-cocoa-600 transition-colors"
                  >
                    <ChevronLeft size={14} /> Volver
                  </button>
                  <p className="text-sm text-cocoa-500">Ingresa los datos del cliente para emitir la factura.</p>

                  <div>
                    <label className="label">Nombre completo *</label>
                    <input className="input" placeholder="Ej: Juan Pérez" value={invoiceData.invoiceName}
                      onChange={e => setInvoiceData({ ...invoiceData, invoiceName: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Cédula / RUC *</label>
                    <div className="relative">
                      <input
                        className="input pr-20"
                        inputMode="numeric"
                        placeholder="Ej: 1712345678 (cédula) o 1790000000001 (RUC)"
                        value={invoiceData.invoiceDocId}
                        onChange={(e) => handleDocIdChange(e.target.value)}
                      />
                      {getDocType(invoiceData.invoiceDocId) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-cocoa-900/5 border border-cocoa-900/10 px-2 py-0.5 text-[10px] font-semibold text-cocoa-500">
                          {getDocType(invoiceData.invoiceDocId)}
                        </span>
                      )}
                      {customerSuggestions.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-milk-200 bg-white shadow-lg">
                          {customerSuggestions.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => applyCustomer(c)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-milk-100 transition-colors"
                            >
                              <span className="font-medium text-cocoa-800">{c.name}</span>
                              <span className="text-cocoa-400">{c.docId}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-cocoa-400">
                      {getDocType(invoiceData.invoiceDocId) === 'Cédula' ? '10 dígitos' : getDocType(invoiceData.invoiceDocId) === 'RUC' ? '13 dígitos' : 'Se autocompleta con clientes ya guardados'}
                    </p>
                  </div>
                  <div>
                    <label className="label">Correo electrónico</label>
                    <input type="email" className="input" placeholder="ejemplo@correo.com" value={invoiceData.invoiceEmail}
                      onChange={e => setInvoiceData({ ...invoiceData, invoiceEmail: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <input className="input" placeholder="0999999999" value={invoiceData.invoicePhone}
                      onChange={e => setInvoiceData({ ...invoiceData, invoicePhone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Dirección</label>
                    <input className="input" placeholder="Latacunga" value={invoiceData.invoiceAddress}
                      onChange={e => setInvoiceData({ ...invoiceData, invoiceAddress: e.target.value })} />
                  </div>
                </div>
                {invoiceResult && (
                  <div className="px-5 pb-2">
                    {invoiceResult.estado === 'AUTORIZADO' ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 space-y-1.5">
                        <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle size={15} /> Factura AUTORIZADA
                        </p>
                        <div className="text-xs text-emerald-700 space-y-0.5">
                          <p className="break-all"><span className="font-medium">Clave:</span> {invoiceResult.claveAcceso}</p>
                          <p className="break-all"><span className="font-medium">Autorización:</span> {invoiceResult.numeroAutorizacion}</p>
                          {invoiceResult.emailEnviado === true && (
                            <p className="flex items-center gap-1 text-emerald-600 font-medium">
                              <CheckCircle size={12} /> Correo enviado al cliente
                            </p>
                          )}
                          {invoiceResult.emailEnviado === false && (
                            <p className="text-[10px] text-amber-600">
                              ⚠️ No se pudo enviar el correo{invoiceResult.emailError ? `: ${invoiceResult.emailError}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                        <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                          <XCircle size={15} /> SRI: {invoiceResult.estado || 'ERROR'}
                        </p>
                        <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto">
                          {(invoiceResult.mensajes || []).map((m, i) => (
                            <p key={i} className="text-xs text-red-600">
                              <span className="font-medium">{m.identificador}:</span> {m.mensaje}
                              {m.informacionAdicional && (
                                <span className="block mt-0.5 text-[11px] text-red-500/90 font-medium">{m.informacionAdicional}</span>
                              )}
                            </p>
                          ))}
                        </div>
                        {invoiceResult.claveAcceso && (
                          <p className="mt-1.5 text-[10px] text-red-500 break-all">Clave: {invoiceResult.claveAcceso}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3 border-t border-milk-200/70 px-6 py-4">
                  {invoiceResult ? (
                    /* Ya se emitió — solo mostrar Cerrar */
                    <button
                      onClick={() => {
                        const updated = { ...invoiceOrderRef, ...invoiceData, numeroAutorizacion: invoiceResult.numeroAutorizacion, claveAcceso: invoiceResult.claveAcceso };
                        printReceipt(updated);
                        setShowInvoiceModal(false);
                      }}
                      className="btn-primary flex-1"
                    >
                      <CheckCircle size={16} /> Cerrar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          // Si está en el formulario, vuelve a la selección de tipo
                          if (showInvoiceForm) {
                            setShowInvoiceForm(false);
                            setInvoiceResult(null);
                          } else {
                            setShowInvoiceModal(false);
                          }
                        }}
                        className="btn-secondary flex-1"
                      >
                        {showInvoiceForm ? 'Atrás' : 'Cancelar'}
                      </button>
                      <button onClick={async () => {
                    if (!invoiceData.invoiceName.trim() || !invoiceData.invoiceDocId.trim()) {
                      toast.error('Nombre y cédula son requeridos');
                      return;
                    }
                    if (!invoiceOrderRef) return;
                    try {
                      const res = await api.patch<any>(`/orders/${invoiceOrderRef.id}/invoice`, invoiceData);
                      if (res.success) {
                        toast.success('Datos de factura guardados');
                        // Guardar cliente para futuras facturas (opcional, no bloquea)
                        await saveCustomer();
                        setEmittingInvoice(true);
                        setInvoiceResult(null);
                        try {
                          const emitRes = await api.post<any>(`/orders/${invoiceOrderRef.id}/emit-invoice`);
                          if (emitRes.success && emitRes.data) {
                            setInvoiceResult({
                              claveAcceso: emitRes.data.claveAcceso,
                              numeroAutorizacion: emitRes.data.numeroAutorizacion,
                              estado: emitRes.data.estado,
                              mensajes: emitRes.data.mensajes || [],
                              emailEnviado: emitRes.data.emailEnviado,
                              emailError: emitRes.data.emailError,
                            });
                            if (emitRes.data.estado === 'AUTORIZADO') {
                              toast.success('Factura electrónica AUTORIZADA por el SRI');
                            } else {
                              toast.error(`SRI: ${emitRes.data.estado}`);
                            }
                          }
                        } catch (emitErr: any) {
                          setInvoiceResult({
                            estado: 'ERROR',
                            mensajes: [{ identificador: 'EMIT', mensaje: emitErr?.response?.data?.error || emitErr?.message || 'Error al emitir' }],
                          });
                          toast.error(emitErr?.response?.data?.error || 'Error al emitir factura con el SRI');
                        } finally {
                          setEmittingInvoice(false);
                        }
                      }
                    } catch (err: any) {
                      toast.error(err?.response?.data?.error || err?.message || 'Error al guardar factura');
                    }
                  }} className="btn-primary flex-1" disabled={emittingInvoice}>
                    {emittingInvoice ? (
                      <><Loader2 size={16} className="animate-spin" /> Emitiendo contra el SRI...</>
                    ) : (
                      'Emitir factura'
                    )}
                  </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Combo selector */}
      {showComboModal && comboProduct && (
        <div className="modal-overlay" onClick={() => setShowComboModal(false)}>
          <div className="w-full max-w-lg modal-content max-h-[90vh] flex flex-col mx-2 sm:mx-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-milk-200/70 px-6 py-4 shrink-0 bg-gradient-to-r from-milk-50/60 to-transparent rounded-t-3xl">
              <h2 className="text-base font-semibold text-cocoa-900 flex items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-gradient-to-b from-cocoa-500 to-cocoa-700" />
                Personalizar {comboProduct.name}
              </h2>
              <button onClick={() => setShowComboModal(false)} className="btn-ghost p-1.5 rounded-xl hover:bg-milk-100"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex items-center gap-3 rounded-xl bg-cocoa-50/50 border border-cocoa-200/60 p-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cocoa-500 to-cocoa-700 text-milk-50 font-bold shadow-md">
                  <Layers size={20} />
                </span>
                <div>
                  <p className="font-semibold text-cocoa-900">{comboProduct.name}</p>
                  <p className="text-sm font-bold text-cocoa-600">{formatCurrency(Number(comboProduct.price))}</p>
                </div>
              </div>

              {comboLines.length === 0 && (
                <p className="text-center text-cocoa-300 py-8">Este combo no tiene opciones configuradas</p>
              )}

              {comboLines.map(line => (
                <div key={line.id} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-gradient-to-b from-cocoa-400 to-cocoa-600" />
                    <p className="text-sm font-semibold text-cocoa-900">{line.label}</p>
                    {line.required && <span className="text-[10px] text-red-500 font-medium">*Requerido</span>}
                    <span className="text-[10px] text-cocoa-300 ml-auto">
                      {line.minSelect === line.maxSelect
                        ? `Selecciona ${line.minSelect}`
                        : `Min ${line.minSelect} · Max ${line.maxSelect}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* Group products by category */}
                    {(() => {
                      const groups = new Map<string, NonNullable<typeof line.comboLineProducts>>();
                      (line.comboLineProducts || []).forEach(clp => {
                        const catName = clp.product.category?.name || 'Otros';
                        if (!groups.has(catName)) groups.set(catName, []);
                        groups.get(catName)!.push(clp);
                      });
                      return Array.from(groups.entries()).map(([catName, clps]) => (
                        <div key={catName} className="col-span-full space-y-1.5">
                          <p className="text-[11px] font-semibold text-cocoa-400 uppercase tracking-wider">{catName}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(clps || []).map(clp => {
                              const opt = clp.product;
                              const isSelected = (comboSelections[line.id] || []).includes(opt.id);
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => toggleComboSelection(line.id, opt.id, line.maxSelect)}
                                  className={`relative flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150 ${
                                    isSelected
                                      ? 'border-cocoa-500 bg-cocoa-50 shadow-md shadow-cocoa-500/20'
                                      : 'border-milk-200 bg-white hover:border-cocoa-300 hover:shadow-sm'
                                  }`}
                                >
                                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                                    isSelected ? 'bg-cocoa-600 text-milk-50' : 'bg-milk-100 text-cocoa-400'
                                  }`}>
                                    {isSelected ? '✓' : ''}
                                  </span>
                                  <span className={`text-sm font-medium ${isSelected ? 'text-cocoa-900' : 'text-cocoa-600'}`}>
                                    {opt.name}
                                  </span>
                                  {isSelected && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cocoa-600 text-milk-50 text-[9px] font-bold shadow-md">
                                      ✓
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                    {(line.comboLineProducts || []).length === 0 && (
                      <p className="text-xs text-cocoa-300 col-span-full text-center py-3">
                        No hay productos disponibles en esta categoría
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-milk-200/70 px-6 py-4 shrink-0 flex gap-3">
              <button onClick={() => setShowComboModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={addComboToCart} className="btn-primary flex-1">
                Agregar al pedido — {formatCurrency(Number(comboProduct.price))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusLegend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-milk-200/80 text-[11px] font-medium text-cocoa-400 shadow-sm"><div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`} />{label}</div>;
}

/**
 * Selector de productos con categorías y grid de productos.
 * - Móvil (base): categorías en FILA HORIZONTAL scrolleable con nombre completo,
 *   productos debajo en 3 columnas. Todo con scroll propio.
 * - Pantallas grandes (sm+): sidebar vertical a la izquierda con texto completo
 *   (wrap en 2 líneas, sin truncar) y productos a la derecha en 3 columnas.
 * Las categorías se ordenan por sortOrder (secuencial) y luego por nombre.
 */
function PosProductPicker({ categories, selectedCategory, onSelectCategory, products, onAddProduct }: {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  products: Product[];
  onAddProduct: (p: Product) => void;
}) {
  // Ordenar por secuencial (sortOrder) y luego por nombre — red de seguridad
  const sortedCategories = [...categories].sort((a, b) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
  );

  const btnBase = 'rounded-lg font-medium transition-all duration-150 shrink-0';
  const btnSelected = 'bg-cocoa-600 text-milk-50 shadow-sm';
  const btnIdle = 'bg-white text-cocoa-500 hover:bg-milk-100 border border-milk-200/80';

  return (
    <div className="flex flex-col sm:flex-row flex-1 min-h-0 gap-2">
      {/* MÓVIL: categorías horizontales scrolleables (nombre completo) */}
      <div className="sm:hidden flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 shrink-0">
        <button
          onClick={() => onSelectCategory(null)}
          className={`${btnBase} px-3 py-2 text-xs whitespace-nowrap ${!selectedCategory ? btnSelected : btnIdle}`}
        >
          Todos
        </button>
        {sortedCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`${btnBase} px-3 py-2 text-xs whitespace-nowrap ${selectedCategory === cat.id ? btnSelected : btnIdle}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* DESKTOP: sidebar vertical a la izquierda (texto completo en 2 líneas) */}
      <div className="hidden sm:flex w-44 shrink-0 flex-col overflow-y-auto rounded-xl border border-milk-200/80 bg-milk-50/70 p-1.5 space-y-1 min-h-0">
        <button
          onClick={() => onSelectCategory(null)}
          className={`w-full text-left rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all duration-150 ${!selectedCategory ? 'bg-cocoa-600 text-milk-50 shadow-sm' : 'text-cocoa-500 hover:bg-milk-100'}`}
        >
          Todos
        </button>
        {sortedCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full text-left rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all duration-150 leading-tight ${selectedCategory === cat.id ? 'bg-cocoa-600 text-milk-50 shadow-sm' : 'text-cocoa-500 hover:bg-milk-100'}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Productos en 3 columnas — con scroll propio */}
      <div className="flex-1 overflow-y-auto min-w-0 min-h-0 pr-0.5">
        {products.length === 0 ? (
          <p className="text-xs text-cocoa-300 text-center py-8">Sin productos en esta categoría</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {products.map(product => (
              <button key={product.id} onClick={() => onAddProduct(product)}
                className="rounded-xl border border-milk-200/90 bg-white p-2.5 text-left hover:border-cocoa-300 hover:shadow-md hover:shadow-cocoa-900/10 hover:-translate-y-0.5 active:scale-95 flex flex-col transition-all duration-150">
                <div className="flex items-center justify-center rounded-lg bg-gradient-to-br from-milk-100 to-milk-200 mb-1.5 h-12"><span className="text-xl">🥛</span></div>
                <h3 className="text-xs font-medium text-cocoa-900 leading-tight line-clamp-2">{product.name}</h3>
                <p className="text-xs font-bold text-cocoa-600 mt-0.5">{formatCurrency(Number(product.price))}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TableModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay p-2 sm:p-4" onClick={(e) => e.stopPropagation()}>
      <div className="w-full max-w-5xl h-[90vh] sm:h-[85vh] modal-content flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-milk-200/70 px-6 py-4 shrink-0 bg-gradient-to-r from-milk-50/60 to-transparent rounded-t-3xl">
          <h2 className="text-base font-semibold text-cocoa-900 flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full bg-gradient-to-b from-cocoa-500 to-cocoa-700" />
            {title}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-xl hover:bg-milk-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
