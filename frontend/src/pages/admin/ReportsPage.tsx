import { useState } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import { formatCurrency, getPaymentMethodLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import { BarChart3, Download, Loader2, Search } from 'lucide-react';
import type { ApiResponse } from '@/types';

export default function ReportsPage() {
  const { currentBranch } = useBranch();
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [salesByProduct, setSalesByProduct] = useState<any[]>([]);
  const [salesByTimeSlot, setSalesByTimeSlot] = useState<any[]>([]);
  const [paymentsByMethod, setPaymentsByMethod] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);

  const loadReports = async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      const [prodRes, slotRes, payRes] = await Promise.all([
        api.get<ApiResponse<any[]>>(`/reports/sales-by-product?branchId=${currentBranch.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
        api.get<ApiResponse<any[]>>(`/reports/sales-by-time-slot?branchId=${currentBranch.id}&date=${dateFrom}`),
        api.get<ApiResponse<any[]>>(`/reports/payments-by-method?branchId=${currentBranch.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
      ]);

      if (prodRes.success) setSalesByProduct(prodRes.data || []);
      if (slotRes.success) setSalesByTimeSlot(slotRes.data || []);
      if (payRes.success) setPaymentsByMethod(payRes.data || []);
    } catch {
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    if (!currentBranch) return;
    setExporting(true);
    try {
      const blob = await api.downloadExcel(`/reports/export-excel?branchId=${currentBranch.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ventas-${dateFrom}-${dateTo}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Reporte exportado');
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  if (!currentBranch) {
    return <div className="flex h-64 items-center justify-center"><p className="text-surface-400">Selecciona un local</p></div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Reportes</h1>
          <p className="text-xs text-surface-400">{currentBranch.name}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button onClick={loadReports} disabled={loading} className="btn-primary">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Consultar
          </button>
          <button onClick={exportToExcel} disabled={exporting} className="btn-secondary">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ventas por producto */}
        <div className="card">
          <div className="border-b border-surface-100 px-4 py-3 flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-500" />
            <h2 className="font-semibold text-surface-900">Ventas por Producto</h2>
          </div>
          <div className="p-4">
            {salesByProduct.length === 0 ? (
              <p className="text-center text-surface-400 py-4">Sin datos para el período</p>
            ) : (
              <div className="space-y-2">
                {salesByProduct.map((sale: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-surface-900">{sale.productId.slice(0, 8)}</span>
                    <div className="flex gap-4">
                      <span className="text-surface-400">{sale._sum?.quantity || 0} und.</span>
                      <span className="font-medium">{formatCurrency(Number(sale._sum?.subtotal || 0))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ventas por franja horaria */}
        <div className="card">
          <div className="border-b border-surface-100 px-4 py-3 flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-500" />
            <h2 className="font-semibold text-surface-900">Ventas por Franja Horaria</h2>
          </div>
          <div className="p-4">
            {salesByTimeSlot.length === 0 ? (
              <p className="text-center text-surface-400 py-4">Sin datos para la fecha</p>
            ) : (
              <div className="space-y-2">
                {salesByTimeSlot.map((slot: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-surface-900">
                      {String(slot.hour).padStart(2, '0')}:00 - {String(slot.hour).padStart(2, '0')}:59
                    </span>
                    <div className="flex gap-4">
                      <span className="text-surface-400">{slot.count} pedidos</span>
                      <span className="font-medium">{formatCurrency(Number(slot.total))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Formas de pago */}
        <div className="card">
          <div className="border-b border-surface-100 px-4 py-3 flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-500" />
            <h2 className="font-semibold text-surface-900">Formas de Pago</h2>
          </div>
          <div className="p-4">
            {paymentsByMethod.length === 0 ? (
              <p className="text-center text-surface-400 py-4">Sin datos para el período</p>
            ) : (
              <div className="space-y-2">
                {paymentsByMethod.map((pm: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-surface-900">{getPaymentMethodLabel(pm.method)}</span>
                    <div className="flex gap-4">
                      <span className="text-surface-400">{pm._count} trans.</span>
                      <span className="font-medium">{formatCurrency(Number(pm._sum?.amount || 0))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
