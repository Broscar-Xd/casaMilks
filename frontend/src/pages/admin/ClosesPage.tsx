import { useState, useEffect } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import { formatCurrency, getPaymentMethodLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Loader2, DollarSign, Receipt, TrendingUp } from 'lucide-react';
import type { DailyClose, ApiResponse } from '@/types';

export default function ClosesPage() {
  const { currentBranch } = useBranch();
  const [closes, setCloses] = useState<DailyClose[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!currentBranch) return;
    try {
      const res = await api.get<ApiResponse<DailyClose[]>>(`/closes?branchId=${currentBranch.id}`);
      if (res.success && res.data) setCloses(res.data);
    } catch { toast.error('Error al cargar cierres'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [currentBranch]);

  const handleClose = async () => {
    if (!currentBranch) return;
    setSubmitting(true);
    try {
      const res = await api.post<ApiResponse<DailyClose>>('/closes', { branchId: currentBranch.id, notes });
      if (res.success) {
        toast.success('Cierre realizado exitosamente');
        setShowNew(false);
        setNotes('');
        fetchData();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar caja');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  if (!currentBranch) return <div className="flex h-64 items-center justify-center"><p className="text-gray-500">Selecciona un local</p></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cierre de Caja</h1>
          <p className="text-xs text-gray-500">{currentBranch.name}</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary"><DollarSign size={18} /> Realizar Cierre</button>
      </div>

      <div className="space-y-4">
        {closes.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <Receipt size={48} className="mx-auto mb-4" />
            <p>No hay cierres registrados</p>
          </div>
        ) : (
          closes.map((close) => (
            <div key={close.id} className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Cierre del {new Date(close.closeDate).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                  <p className="text-sm text-gray-500">Realizado por: {close.user?.name || '—'}</p>
                </div>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(close.totalSales)}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                <div className="rounded-xl bg-emerald-50/60 p-3 text-center">
                  <p className="text-xs text-surface-400">Efectivo</p>
                  <p className="font-semibold text-emerald-700">{formatCurrency(close.cashTotal)}</p>
                </div>
                <div className="rounded-xl bg-blue-50/60 p-3 text-center">
                  <p className="text-xs text-surface-400">Tarjeta</p>
                  <p className="font-semibold text-blue-700">{formatCurrency(close.cardTotal)}</p>
                </div>
                <div className="rounded-xl bg-purple-50/60 p-3 text-center">
                  <p className="text-xs text-surface-400">Transferencia</p>
                  <p className="font-semibold text-purple-700">{formatCurrency(close.transferTotal)}</p>
                </div>
                <div className="rounded-xl bg-orange-50/60 p-3 text-center">
                  <p className="text-xs text-surface-400">Deuna</p>
                  <p className="font-semibold text-orange-700">{formatCurrency(close.deunaTotal)}</p>
                </div>
                <div className="rounded-xl bg-pink-50/60 p-3 text-center">
                  <p className="text-xs text-surface-400">PanaPay</p>
                  <p className="font-semibold text-pink-700">{formatCurrency(close.panapayTotal)}</p>
                </div>
              </div>

              <div className="flex gap-4 text-sm text-surface-400">
                <span>Transacciones: <strong>{close.totalTransactions}</strong></span>
                <span>Ticket promedio: <strong>{formatCurrency(close.averageTicket)}</strong></span>
              </div>

              {close.notes && (
                <div className="mt-3 rounded-xl bg-surface-50 p-3 text-sm text-surface-500">
                  <span className="font-medium">Notas:</span> {close.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showNew && (
        <div className="modal-overlay">
          <div className="w-full max-w-md modal-content mx-2 sm:mx-0">
            <div className="border-b border-surface-100 px-6 py-4">
              <h2 className="text-lg font-semibold">Confirmar Cierre de Caja</h2>
              <p className="text-sm text-surface-400">Se cerrará el día {new Date().toLocaleDateString('es-EC')}</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-surface-500 mb-4">
                Al realizar el cierre se calcularán automáticamente los totales del día. 
                Esta acción solo puede realizarse una vez por día.
              </p>
              <div>
                <label className="label">Notas (opcional)</label>
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones del cierre..." />
              </div>
            </div>
            <div className="flex gap-3 border-t border-surface-100 px-6 py-4">
              <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleClose} disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'Procesando...' : 'Confirmar Cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
