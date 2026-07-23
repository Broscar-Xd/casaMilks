import { useState, useEffect, useCallback } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Clock, ChefHat, Loader2, CheckCircle } from 'lucide-react';
import type { KitchenSend, ApiResponse } from '@/types';

export default function KitchenPage() {
  const { currentBranch } = useBranch();
  const [sends, setSends] = useState<KitchenSend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSends = useCallback(async () => {
    if (!currentBranch) return;
    try {
      const res = await api.get<ApiResponse<KitchenSend[]>>(`/orders/kitchen?branchId=${currentBranch.id}`);
      if (res.success && res.data) setSends(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [currentBranch]);

  useEffect(() => {
    fetchSends();
    const interval = setInterval(fetchSends, 8000);
    return () => clearInterval(interval);
  }, [fetchSends]);

  const markReady = async (sendId: string) => {
    try {
      const res = await api.patch<ApiResponse<KitchenSend>>(`/orders/kitchen/${sendId}/ready`);
      if (res.success) {
        toast.success('Marcado como listo');
        fetchSends();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  if (!currentBranch) return <div className="flex h-64 items-center justify-center"><p className="text-surface-400">Selecciona un local</p></div>;
  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  return (
    <div>
      <div className="mb-4"><h1 className="text-lg font-semibold text-surface-900">Cocina</h1>
        <p className="text-xs text-surface-400">{currentBranch.name} — {sends.length} pedido{sends.length !== 1 ? 's' : ''} pendiente{sends.length !== 1 ? 's' : ''}</p>
      </div>
      {sends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-surface-300">
          <ChefHat size={64} className="mb-4" />
          <p className="text-lg font-medium text-surface-400">No hay pedidos pendientes</p>
          <p className="text-sm text-surface-300">Los pedidos aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sends.map((send) => (
            <div key={send.id} className="card overflow-hidden">
              <div className="border-b border-surface-100 bg-surface-50/60 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-surface-800">{send.order?.table?.name || 'Mesa'}</p>
                    <p className="text-xs text-surface-400">{send.order?.notes || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-surface-400">
                    <Clock size={14} />
                    {new Date(send.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                {send.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-600 shadow-soft">{item.quantity}</span>
                    <span className="text-sm font-medium text-surface-700">{item.product?.name || 'Producto'}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-surface-100 px-4 py-3">
                <button onClick={() => markReady(send.id)} className="btn-success w-full py-2">
                  <CheckCircle size={16} /> Marcar como Listo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
