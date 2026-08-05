import { useState, useEffect, useCallback } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Search, Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Eye, FileText, X } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import { usePagination } from '@/hooks/usePagination';
import type { ElectronicReceipt, ApiResponse } from '@/types';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  AUTHORIZED: { label: 'Autorizada', cls: 'badge-ready' },
  REJECTED: { label: 'No autorizada', cls: 'badge-cancelled' },
  PENDING: { label: 'Pendiente', cls: 'badge-pending' },
  EMITTED: { label: 'Emitida', cls: 'badge-pending' },
  CANCELLED: { label: 'Anulada', cls: 'badge-cancelled' },
};

export default function ReceiptsPage() {
  const { currentBranch } = useBranch();
  const [receipts, setReceipts] = useState<ElectronicReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ElectronicReceipt | null>(null);

  const fetchReceipts = useCallback(async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ElectronicReceipt[]>>(`/receipts?branchId=${currentBranch.id}`);
      if (res.success && res.data) setReceipts(res.data);
    } catch {
      toast.error('Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  }, [currentBranch]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  const filtered = receipts.filter((r) => {
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (r.claveAcceso || '').toLowerCase().includes(q) ||
      (r.numeroAutorizacion || '').toLowerCase().includes(q) ||
      (r.order?.invoiceName || '').toLowerCase().includes(q) ||
      (r.order?.invoiceDocId || '').includes(q);
    return matchStatus && matchSearch;
  });

  const { page, totalPages, total, pageSize, paginatedItems, setPage } = usePagination(filtered, 12);

  const resend = async (receipt: ElectronicReceipt) => {
    if (!confirm(`¿Reenviar la factura sec ${receipt.sequential} al SRI?\nSe generará una nueva clave de acceso y secuencial.`)) return;
    setResendingId(receipt.id);
    try {
      const res = await api.post<ApiResponse<any>>(`/receipts/${receipt.id}/resend`);
      if (res.success) {
        if (res.data?.estado === 'AUTORIZADO') {
          toast.success(`Factura reenviada y AUTORIZADA (sec ${res.data.sequential})`);
        } else {
          const msgs = (res.data?.mensajes || [])
            .map((m: any) => `${m.mensaje}${m.informacionAdicional ? ' - ' + m.informacionAdicional : ''}`)
            .join(' | ');
          toast.error(`SRI: ${res.data?.estado || 'ERROR'}${msgs ? ' — ' + msgs : ''}`);
        }
        fetchReceipts();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Error al reenviar');
    } finally {
      setResendingId(null);
    }
  };

  const downloadPdf = async (receipt: ElectronicReceipt) => {
    try {
      const res = await api.get<Response>(`/receipts/${receipt.id}/pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nota_venta_${receipt.claveAcceso || receipt.sequential}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Nota de venta descargada');
    } catch (err: any) {
      toast.error(err?.message || 'Error al descargar la nota de venta');
    }
  };

  if (!currentBranch) {
    return <div className="flex h-64 items-center justify-center"><p className="text-gray-500">Selecciona un local</p></div>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Facturas Electrónicas</h1>
        <p className="text-xs text-gray-500">{currentBranch.name} — {receipts.length} facturas</p>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por clave, autorización, cliente o cédula..."
            className="input py-2 text-sm flex-1 min-w-[220px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input py-2 text-sm w-auto"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">Todos los estados</option>
            <option value="AUTHORIZED">Autorizadas</option>
            <option value="REJECTED">No autorizadas</option>
            <option value="PENDING">Pendientes</option>
            <option value="EMITTED">Emitidas</option>
            <option value="CANCELLED">Anuladas</option>
          </select>
        </div>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-cocoa-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-gray-400 font-medium">No hay facturas que coincidan</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-milk-200/70 bg-milk-50/50 text-left text-xs uppercase tracking-wide text-cocoa-400">
                  <th className="px-4 py-3 font-semibold">Sec.</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Cédula/RUC</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((r) => {
                  const meta = STATUS_META[r.status] || { label: r.status, cls: 'badge-pending' };
                  const canResend = r.status === 'REJECTED' || r.status === 'EMITTED' || r.status === 'PENDING';
                  return (
                    <tr key={r.id} className="border-b border-milk-100 hover:bg-milk-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-cocoa-600">{String(r.sequential).padStart(9, '0')}</td>
                      <td className="px-4 py-3 text-cocoa-700">{new Date(r.createdAt).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-3 font-medium text-cocoa-800">{r.order?.invoiceName || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-cocoa-500">{r.order?.invoiceDocId || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-cocoa-800">{formatCurrency(Number(r.order?.total || 0))}</td>
                      <td className="px-4 py-3">
                        <span className={`${meta.cls} inline-flex items-center gap-1`}>
                          {r.status === 'AUTHORIZED' ? <CheckCircle2 size={12} /> : r.status === 'REJECTED' ? <XCircle size={12} /> : <Clock size={12} />}
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelected(r)}
                            className="btn-ghost p-1.5 rounded-lg hover:bg-milk-100"
                            title="Ver detalle"
                          >
                            <Eye size={15} className="text-cocoa-500" />
                          </button>
                          <button
                            onClick={() => downloadPdf(r)}
                            className="btn-ghost p-1.5 rounded-lg hover:bg-milk-100"
                            title="Descargar nota de venta"
                          >
                            <FileText size={15} className="text-cocoa-500" />
                          </button>
                          {canResend && (
                            <button
                              onClick={() => resend(r)}
                              disabled={resendingId === r.id}
                              className="btn-ghost p-1.5 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                              title="Volver a enviar al SRI"
                            >
                              {resendingId === r.id ? <Loader2 size={15} className="animate-spin text-amber-600" /> : <RefreshCw size={15} className="text-amber-600" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-milk-200/70 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg modal-content max-h-[90vh] overflow-y-auto mx-2 sm:mx-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-milk-200/70 px-6 py-4">
              <h2 className="text-base font-semibold text-cocoa-900">Factura sec {String(selected.sequential).padStart(9, '0')}</h2>
              <button onClick={() => setSelected(null)} className="btn-ghost p-1.5 rounded-xl hover:bg-milk-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-cocoa-300 mb-0.5">Estado</p>
                  <span className={`${(STATUS_META[selected.status] || STATUS_META.PENDING).cls}`}>
                    {(STATUS_META[selected.status] || { label: selected.status }).label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-cocoa-300 mb-0.5">Ambiente</p>
                  <p className="font-medium text-cocoa-800">{selected.ambiente === '2' ? 'Producción' : 'Pruebas'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-cocoa-300 mb-0.5">Cliente</p>
                <p className="font-medium text-cocoa-800">{selected.order?.invoiceName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-cocoa-300 mb-0.5">Cédula / RUC</p>
                <p className="font-mono text-cocoa-700">{selected.order?.invoiceDocId || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-cocoa-300 mb-0.5">Clave de acceso</p>
                <p className="font-mono text-xs break-all text-cocoa-700">{selected.claveAcceso || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-cocoa-300 mb-0.5">Número de autorización</p>
                <p className="font-mono text-xs break-all text-emerald-700">{selected.numeroAutorizacion || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-cocoa-300 mb-0.5">Total</p>
                <p className="font-semibold text-cocoa-900">{formatCurrency(Number(selected.order?.total || 0))}</p>
              </div>
              {selected.errorMessage && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-xs text-red-600 font-medium">Error del SRI:</p>
                  <p className="text-xs text-red-500 mt-0.5 break-all">{selected.errorMessage}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2 border-t border-milk-100">
                <button onClick={() => downloadPdf(selected)} className="btn-secondary flex-1 text-sm py-2">
                  <FileText size={15} /> Descargar nota de venta
                </button>
                {(selected.status === 'REJECTED' || selected.status === 'EMITTED' || selected.status === 'PENDING') && (
                  <button
                    onClick={() => { resend(selected); }}
                    disabled={resendingId === selected.id}
                    className="btn-primary flex-1 text-sm py-2"
                  >
                    {resendingId === selected.id ? <><Loader2 size={15} className="animate-spin" /> Reenviando...</> : <><RefreshCw size={15} /> Volver a enviar</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
