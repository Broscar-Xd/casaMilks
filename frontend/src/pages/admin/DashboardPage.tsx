import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { formatCurrency } from '@/lib/utils';
import { useBranch } from '@/contexts/BranchContext';
import toast from 'react-hot-toast';
import { Loader2, TrendingUp, ShoppingCart, DollarSign, Receipt } from 'lucide-react';
import type { ApiResponse, Order, DailyClose } from '@/types';

export default function DashboardPage() {
  const { currentBranch } = useBranch();
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [lastClose, setLastClose] = useState<DailyClose | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBranch) return;

    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [ordersRes, closeRes] = await Promise.all([
          api.get<ApiResponse<Order[]>>(`/orders?branchId=${currentBranch.id}&dateFrom=${today}`),
          api.get<ApiResponse<DailyClose>>(`/closes/by-date?branchId=${currentBranch.id}&date=${today}`),
        ]);

        if (ordersRes.success && ordersRes.data) setTodayOrders(ordersRes.data);
        if (closeRes.success) setLastClose(closeRes.data || null);
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
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const activeOrders = todayOrders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status));
  const totalToday = todayOrders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.total), 0);
  const transactionsToday = todayOrders.filter((o) => o.status !== 'CANCELLED').length;
  const avgTicket = transactionsToday > 0 ? totalToday / transactionsToday : 0;

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
                    order.status === 'DELIVERED' ? 'text-green-600' : order.status === 'CANCELLED' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {order.status === 'DELIVERED' ? 'Entregado' : order.status === 'CANCELLED' ? 'Cancelado' : 'Pendiente'}
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
