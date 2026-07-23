import { useState, useEffect, useCallback } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import { formatCurrency, getPaymentMethodLabel, getOrderStatusLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Search, Loader2, Eye, X, Receipt, Filter } from 'lucide-react';
import type { Order, ApiResponse, PaymentMethod } from '@/types';

type PaymentBreakdown = { method: string; amount: number; reference: string | null }[];

export default function OrdersHistoryPage() {
  const { currentBranch } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Order[]>>(
        `/orders?branchId=${currentBranch.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      if (res.success && res.data) setOrders(res.data);
    } catch {
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [currentBranch, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const viewDetail = async (orderId: string) => {
    try {
      const res = await api.get<ApiResponse<Order>>(`/orders/${orderId}`);
      if (res.success && res.data) setSelectedOrder(res.data);
    } catch {
      toast.error('Error al cargar detalle');
    }
  };

  const filtered = searchId
    ? orders.filter((o) => o.id.toLowerCase().includes(searchId.toLowerCase()))
    : orders;

  // Agrupar pagos por método
  const paymentBreakdown = (order: Order): PaymentBreakdown => {
    const map = new Map<string, { amount: number; reference: string | null }>();
    for (const p of order.payments || []) {
      const existing = map.get(p.method);
      if (existing) {
        existing.amount += Number(p.amount);
      } else {
        map.set(p.method, { amount: Number(p.amount), reference: p.referenceNumber });
      }
    }
    return Array.from(map.entries()).map(([method, data]) => ({
      method,
      amount: data.amount,
      reference: data.reference,
    }));
  };

  if (!currentBranch) {
    return <div className="flex h-64 items-center justify-center"><p className="text-gray-500">Selecciona un local</p></div>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Historial de Pedidos</h1>
        <p className="text-xs text-gray-500">{currentBranch.name}</p>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label text-xs">Desde</label>
            <input type="date" className="input py-2 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Hasta</label>
            <input type="date" className="input py-2 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <input
            type="text"
            placeholder="Buscar por ID..."
            className="input py-2 text-sm"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button onClick={fetchOrders} disabled={loading} className="btn-primary py-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Buscar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50/80">
              <tr>
                <th className="table-header">Pedido</th>
                <th className="table-header">Mesa</th>
                <th className="table-header">Estado</th>
                <th className="table-header text-right">Total</th>
                <th className="table-header text-right">Fecha</th>
                <th className="table-header text-right">Pagos</th>
                <th className="table-header text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay pedidos en este período</td></tr>
              )}
              {filtered.map((order) => {
                const breakdown = paymentBreakdown(order);
                return (
                  <tr key={order.id} className="table-row">
                    <td className="table-cell font-medium text-surface-900">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="table-cell">{order.table?.name || '—'}</td>
                    <td className="table-cell">
                      <span className={`badge ${order.status === 'CLOSED' ? 'bg-emerald-50 text-emerald-700' : order.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        {order.status === 'CLOSED' ? 'Cobrado' : order.status === 'CANCELLED' ? 'Cancelado' : 'Abierto'}
                      </span>
                    </td>
                    <td className="table-cell text-right font-semibold text-surface-900">
                      {formatCurrency(Number(order.total))}
                    </td>
                    <td className="table-cell text-right text-surface-400 text-xs">
                      {new Date(order.createdAt).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="table-cell text-right">
                      {breakdown.length > 0 ? (
                        <div className="text-xs space-y-0.5">
                          {breakdown.slice(0, 2).map((p, i) => (
                            <div key={i} className="text-gray-500">
                              {getPaymentMethodLabel(p.method)}: {formatCurrency(p.amount)}
                            </div>
                          ))}
                          {breakdown.length > 2 && <div className="text-gray-400">+{breakdown.length - 2} más</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right">
                      <button onClick={() => viewDetail(order.id)} className="btn-ghost p-1.5">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalle */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="w-full max-w-lg modal-content max-h-[80vh] overflow-y-auto mx-2 sm:mx-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-surface-900">
                  Pedido #{selectedOrder.id.slice(0, 8).toUpperCase()}
                </h2>
                <p className="text-xs text-surface-400">
                  Mesa: {selectedOrder.table?.name} — {new Date(selectedOrder.createdAt).toLocaleString('es-EC')}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Productos */}
              <div>
                <h3 className="text-sm font-semibold text-surface-900 mb-2">Productos</h3>
                <div className="space-y-1.5">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-surface-700">{item.product?.name} <span className="text-surface-400">x{item.quantity}</span></span>
                      <span className="font-medium text-surface-900">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-surface-100 mt-3 pt-3 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(Number(selectedOrder.total))}</span>
                </div>
              </div>

              <div className="divider" />

              {/* Pagos */}
              <div>
                <h3 className="text-sm font-semibold text-surface-900 mb-2">Formas de Pago</h3>
                {selectedOrder.payments && selectedOrder.payments.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const breakdown = paymentBreakdown(selectedOrder);
                      return breakdown.map((p, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-sm font-medium text-surface-800">{getPaymentMethodLabel(p.method)}</span>
                            {p.reference && (
                              <span className="text-xs text-surface-400 ml-2">N° {p.reference}</span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-surface-900">{formatCurrency(p.amount)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-surface-400">Sin pagos registrados</p>
                )}
              </div>

              {/* Atendido por */}
              {selectedOrder.user && (
                <div className="text-xs text-surface-400">
                  Atendido por: <span className="font-medium text-surface-600">{selectedOrder.user.name}</span>
                </div>
              )}
              {selectedOrder.customerName && (
                <div className="text-xs text-surface-400">
                  Cliente: <span className="font-medium text-surface-600">{selectedOrder.customerName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
