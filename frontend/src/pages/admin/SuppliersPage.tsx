import { useState, useEffect, useCallback } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Search, Loader2, X, Download, Banknote, Smartphone } from 'lucide-react';
import type { ApiResponse } from '@/types';

interface SupplierPayment {
  id: string;
  supplierName: string;
  cashAmount: number;
  transferAmount: number;
  total: number;
  notes: string | null;
  createdAt: string;
  branchId: string;
}

export default function SuppliersPage() {
  const { currentBranch } = useBranch();
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ supplierName: '', cashAmount: '', transferAmount: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      let url = `/suppliers?branchId=${currentBranch.id}`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;
      if (supplierFilter) url += `&supplierName=${encodeURIComponent(supplierFilter)}`;

      const res = await api.get<ApiResponse<SupplierPayment[]>>(url);
      if (res.success && res.data) setPayments(res.data);
    } catch { toast.error('Error al cargar pagos'); }
    finally { setLoading(false); }
  }, [currentBranch, dateFrom, dateTo, supplierFilter]);

  const fetchSuppliers = useCallback(async () => {
    if (!currentBranch) return;
    try {
      const res = await api.get<ApiResponse<Array<{ supplierName: string }>>>(`/suppliers/list?branchId=${currentBranch.id}`);
      if (res.success && res.data) setSuppliers(res.data.map(s => s.supplierName));
    } catch { /* silent */ }
  }, [currentBranch]);

  useEffect(() => { fetchPayments(); fetchSuppliers(); }, [fetchPayments, fetchSuppliers]);

  const totals = {
    cash: payments.reduce((s, p) => s + Number(p.cashAmount), 0),
    transfer: payments.reduce((s, p) => s + Number(p.transferAmount), 0),
    total: payments.reduce((s, p) => s + Number(p.total), 0),
  };

  const openModal = () => {
    setForm({ supplierName: '', cashAmount: '0', transferAmount: '0', notes: '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.supplierName.trim()) { toast.error('Nombre del proveedor requerido'); return; }
    const cash = parseFloat(form.cashAmount) || 0;
    const transfer = parseFloat(form.transferAmount) || 0;
    if (cash <= 0 && transfer <= 0) { toast.error('Debe ingresar al menos un monto'); return; }

    setSubmitting(true);
    try {
      const res = await api.post<ApiResponse<SupplierPayment>>('/suppliers', {
        branchId: currentBranch!.id,
        supplierName: form.supplierName.trim(),
        cashAmount: cash,
        transferAmount: transfer,
        notes: form.notes || null,
      });
      if (res.success) {
        toast.success('Pago registrado');
        setShowModal(false);
        fetchPayments();
        fetchSuppliers();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar pago');
    } finally { setSubmitting(false); }
  };

  const exportToExcel = async () => {
    // Generar CSV simple
    const headers = ['Proveedor,Efectivo,Transferencia,Total,Fecha,Notas'];
    const rows = payments.map(p =>
      `"${p.supplierName}",${Number(p.cashAmount).toFixed(2)},${Number(p.transferAmount).toFixed(2)},${Number(p.total).toFixed(2)},"${new Date(p.createdAt).toLocaleDateString('es-EC')}","${p.notes || ''}"`
    );
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos-proveedores-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Archivo descargado');
  };

  if (!currentBranch) return <div className="flex h-64 items-center justify-center"><p className="text-gray-500">Selecciona un local</p></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-xs text-gray-500">{currentBranch.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn-secondary"><Download size={16} /> Exportar</button>
          <button onClick={openModal} className="btn-primary"><Plus size={18} /> Agregar Pago</button>
        </div>
      </div>

      {/* Reporte resumen */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="kpi-card">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Banknote size={16} /></div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Efectivo</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(totals.cash)}</p>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Smartphone size={16} /></div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Transferencia</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(totals.transfer)}</p>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Banknote size={16} /></div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Total</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(totals.total)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label text-xs">Desde</label>
            <input type="date" className="input py-2 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Hasta</label>
            <input type="date" className="input py-2 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Proveedor</label>
            <select className="input py-2 text-sm" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
              <option value="">Todos</option>
              {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={fetchPayments} className="btn-primary py-2"><Search size={16} /> Buscar</button>
          {(dateFrom || dateTo || supplierFilter) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setSupplierFilter(''); }} className="btn-secondary py-2">Limpiar</button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50/80">
              <tr>
                <th className="table-header">Proveedor</th>
                <th className="table-header text-right">Efectivo</th>
                <th className="table-header text-right">Transferencia</th>
                <th className="table-header text-right">Total</th>
                <th className="table-header text-right">Fecha</th>
                <th className="table-header">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-500" /></td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay pagos registrados</td></tr>
              ) : payments.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell font-medium text-surface-900">{p.supplierName}</td>
                  <td className="table-cell text-right text-surface-900">{formatCurrency(Number(p.cashAmount))}</td>
                  <td className="table-cell text-right text-surface-900">{formatCurrency(Number(p.transferAmount))}</td>
                  <td className="table-cell text-right font-semibold text-surface-900">{formatCurrency(Number(p.total))}</td>
                  <td className="table-cell text-right text-surface-400 text-xs">
                    {new Date(p.createdAt).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="table-cell text-surface-400 max-w-[200px] truncate">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-md modal-content mx-2 sm:mx-0">
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
              <h2 className="text-base font-semibold text-surface-900">Registrar Pago a Proveedor</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre del proveedor *</label>
                <input className="input" placeholder="Ej: Distribuidora XYZ" value={form.supplierName}
                  onChange={e => setForm({ ...form, supplierName: e.target.value })} list="suppliers-list" required />
                <datalist id="suppliers-list">
                  {suppliers.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Efectivo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" step="0.01" min="0" className="input pl-7" placeholder="0.00" value={form.cashAmount}
                      onChange={e => setForm({ ...form, cashAmount: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Transferencia</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" step="0.01" min="0" className="input pl-7" placeholder="0.00" value={form.transferAmount}
                      onChange={e => setForm({ ...form, transferAmount: e.target.value })} />
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Notas (opcional)</label>
                <textarea className="input" rows={2} placeholder="Observaciones..." value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Total pago</span>
                  <span>{formatCurrency((parseFloat(form.cashAmount) || 0) + (parseFloat(form.transferAmount) || 0))}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Guardando...' : 'Registrar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
