import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { formatCurrency } from '@/lib/utils';
import { todayLocalDate } from '@/lib/date';
import { useBranch } from '@/contexts/BranchContext';
import toast from 'react-hot-toast';
import { Loader2, TrendingUp, ShoppingCart, DollarSign, Receipt, Wallet, PiggyBank } from 'lucide-react';
import type { ApiResponse, Order, DailyClose } from '@/types';

export default function DashboardPage() {
  const { currentBranch } = useBranch();
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [lastClose, setLastClose] = useState<DailyClose | null>(null);
  const [supplierToday, setSupplierToday] = useState(0);
  const [supplierCashToday, setSupplierCashToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBranch) return;

    const fetchData = async () => {
      try {
        const today = todayLocalDate();
        const [ordersRes, closeRes, supplierRes] = await Promise.all([
          api.get<ApiResponse<Order[]>>(`/orders?branchId=${currentBranch.id}&dateFrom=${today}`),
          api.get<ApiResponse<DailyClose>>(`/closes/by-date?branchId=${currentBranch.id}&date=${today}`),
          api.get<ApiResponse<{ total: number; cashTotal: number; transferTotal: number }>>(`/suppliers/sum?branchId=${currentBranch.id}&date=${today}`),
        ]);

        if (ordersRes.success && ordersRes.data) setTodayOrders(ordersRes.data);
        if (closeRes.success) setLastClose(closeRes.data || null);
        if (supplierRes.success && supplierRes.data) {
          setSupplierToday(supplierRes.data.total);
          setSupplierCashToday(supplierRes.data.cashTotal);
        }
      } catch {
        // Silencioso
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentBranch]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-cocoa-500" />
      </div>
    );
  }

  const activeOrders = todayOrders.filter((o) => !['CLOSED', 'CANCELLED'].includes(o.status));
  const closedOrders = todayOrders.filter((o) => o.status === 'CLOSED');
  const totalToday = todayOrders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.total), 0);
  const transactionsToday = todayOrders.filter((o) => o.status !== 'CANCELLED').length;
  const avgTicket = transactionsToday > 0 ? totalToday / transactionsToday : 0;
  // Valor neto diario = Ventas Hoy − pagos a proveedores de hoy
  const netToday = totalToday - supplierToday;

  // Ventas por método (sobre pedidos cerrados de hoy)
  const salesByMethod = (() => {
    const totals: Record<string, number> = {};
    for (const o of closedOrders) {
      for (const p of o.payments || []) {
        totals[p.method] = (totals[p.method] || 0) + Number(p.amount);
      }
    }
    return totals;
  })();
  // Neto en caja = Ventas de hoy (todos los métodos) − solo pagos a proveedores en EFECTIVO
  const netoCaja = totalToday - supplierCashToday;

  // Pagos por método (sobre pedidos cerrados de hoy)
  const paymentsByMethod = (() => {
    const counts: Record<string, number> = {};
    const totals: Record<string, number> = {};
    for (const o of closedOrders) {
      for (const p of o.payments || []) {
        counts[p.method] = (counts[p.method] || 0) + 1;
        totals[p.method] = (totals[p.method] || 0) + Number(p.amount);
      }
    }
    return { counts, totals };
  })();

  const methodLabels: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    DEUNA: 'Deuna',
    PANAPAY: 'PanaPay',
  };
  const methodOrder = ['CASH', 'TRANSFER', 'CARD', 'DEUNA', 'PANAPAY'];
  const methodColors: Record<string, string> = {
    CASH: 'text-emerald-600',
    TRANSFER: 'text-blue-600',
    CARD: 'text-violet-600',
    DEUNA: 'text-amber-600',
    PANAPAY: 'text-rose-600',
  };
  const methodsWithPayments = methodOrder.filter((m) => (paymentsByMethod.counts[m] || 0) > 0);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Receipt size={18} />
            </div>
            <div>
              <p className="text-xs text-surface-400 font-medium">Pedidos Activos</p>
              <p className="text-2xl font-semibold text-surface-900">{activeOrders.length}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign size={18} />
            </div>
            <div>
              <p className="text-xs text-surface-400 font-medium">Ventas Hoy</p>
              <p className="text-2xl font-semibold text-surface-900">{formatCurrency(totalToday)}</p>
            </div>
          </div>
          {/* Pagos por método */}
          {methodsWithPayments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-100 space-y-1">
              {methodsWithPayments.map((m) => (
                <div key={m} className="flex items-center justify-between text-xs">
                  <span className="text-surface-500">{methodLabels[m]}:</span>
                  <span className={`font-semibold ${methodColors[m]}`}>
                    {paymentsByMethod.counts[m]} ({formatCurrency(paymentsByMethod.totals[m])})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <ShoppingCart size={18} />
            </div>
            <div>
              <p className="text-xs text-surface-400 font-medium">Transacciones</p>
              <p className="text-2xl font-semibold text-surface-900">{transactionsToday}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-xs text-surface-400 font-medium">Ticket Promedio</p>
              <p className="text-2xl font-semibold text-surface-900">{formatCurrency(avgTicket)}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <PiggyBank size={18} />
            </div>
            <div>
              <p className="text-xs text-surface-400 font-medium">Valor Neto Diario</p>
              <p className={`text-2xl font-semibold ${netToday < 0 ? 'text-red-600' : 'text-teal-600'}`}>
                {formatCurrency(netToday)}
              </p>
            </div>
          </div>
          {/* Desglose: Ventas − Proveedores */}
          <div className="mt-3 pt-3 border-t border-surface-100 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500">Ventas hoy:</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(totalToday)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500">Pagos a proveedores:</span>
              <span className="font-semibold text-red-500">− {formatCurrency(supplierToday)}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-100">
              <span className="font-medium text-surface-600">Neto:</span>
              <span className={`font-bold ${netToday < 0 ? 'text-red-600' : 'text-teal-600'}`}>{formatCurrency(netToday)}</span>
            </div>
          </div>
        </div>

        {/* Neto en CAJA: Ventas de hoy − solo pagos a proveedores en efectivo */}
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-xs text-surface-400 font-medium">Neto Caja</p>
              <p className={`text-2xl font-semibold ${netoCaja < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(netoCaja)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-surface-100 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500">Ventas hoy:</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(totalToday)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500">Proveedores (efectivo):</span>
              <span className="font-semibold text-red-500">− {formatCurrency(supplierCashToday)}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-100">
              <span className="font-medium text-surface-600">Neto:</span>
              <span className={`font-bold ${netoCaja < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(netoCaja)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent orders */}
        <div className="card overflow-hidden">
          <div className="border-b border-surface-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-surface-900">Pedidos Recientes</h2>
          </div>
          <div className="divide-y divide-surface-100 max-h-80 overflow-y-auto">
            {todayOrders.slice(0, 10).map((order) => (
              <div key={order.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-50/60 transition-colors">
                <div>
                  <p className="text-sm font-medium text-surface-800">#{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-surface-400">
                    {new Date(order.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(Number(order.total))}</p>
                  <span className={`text-xs ${
                    order.status === 'CLOSED' ? 'text-green-600' : order.status === 'CANCELLED' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {order.status === 'CLOSED' ? 'Cobrado' : order.status === 'CANCELLED' ? 'Cancelado' : 'Abierto'}
                  </span>
                </div>
              </div>
            ))}
            {todayOrders.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No hay pedidos hoy</p>
            )}
          </div>
        </div>

        {/* Last close info */}
        <div className="card">
          <div className="border-b border-surface-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-surface-900">Último Cierre</h2>
          </div>
          <div className="p-5">
            {lastClose ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-surface-400">Fecha de cierre</span>
                  <span className="font-medium text-surface-800">{new Date(lastClose.closeDate).toLocaleDateString('es-EC')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total ventas</span>
                  <span className="font-medium">{formatCurrency(lastClose.totalSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Transacciones</span>
                  <span className="font-medium">{lastClose.totalTransactions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ticket promedio</span>
                  <span className="font-medium">{formatCurrency(lastClose.averageTicket)}</span>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">No hay cierres registrados</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
