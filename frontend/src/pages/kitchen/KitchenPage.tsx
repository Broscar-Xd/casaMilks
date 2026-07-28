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

  if (!currentBranch) return <div className="flex h-64 items-center justify-center"><p className="text-cocoa-300">Selecciona un local</p></div>;
  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-cocoa-500" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cocina</h1>
        <p className="page-subtitle">{currentBranch.name} — {sends.length} pedido{sends.length !== 1 ? 's' : ''} pendiente{sends.length !== 1 ? 's' : ''}</p>
      </div>
      {sends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-milk-100 to-milk-200 shadow-inner mb-5">
            <ChefHat size={44} className="text-cocoa-300" />
          </div>
          <p className="text-lg font-semibold text-cocoa-400">No hay pedidos pendientes</p>
          <p className="text-sm text-cocoa-300 mt-1">Los pedidos aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sends.map((send) => (
            <div key={send.id} className="card overflow-hidden hover:shadow-md hover:shadow-cocoa-900/10 transition-all duration-200 hover:-translate-y-0.5">
              {/* Header tipo ticket */}
              <div className="border-b border-milk-200/70 bg-gradient-to-r from-cocoa-900 to-cocoa-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-milk-50 text-sm">{send.order?.table?.name || 'Para llevar'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-milk-200">
                    <Clock size={13} />
                    {new Date(send.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              {/* Items */}
              <div className="px-4 py-3 space-y-2">
                {send.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cocoa-500 to-cocoa-700 text-xs font-bold text-milk-50 shadow-sm">{item.quantity}</span>
                    <span className="text-sm font-medium text-cocoa-800">{item.product?.name || 'Producto'}</span>
                  </div>
                ))}
                {/* Combo breakdown */}
                {send.comboItems && send.comboItems.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-milk-200/50 space-y-1.5">
                    {send.comboItems.map(ci => (
                      <div key={ci.id} className="flex items-center gap-2 pl-4">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-milk-400 to-milk-500 text-[10px] font-bold text-cocoa-900 shadow-sm">{ci.quantity}</span>
                        <span className="text-xs text-cocoa-600 font-medium">{ci.productName}</span>
                        {ci.lineLabel && (
                          <span className="text-[10px] text-cocoa-300 ml-auto italic">{ci.lineLabel}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {send.order?.notes && (
                <div className="mx-4 mb-2 rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2">
                  <p className="text-xs text-amber-700"><span className="font-semibold">Nota:</span> {send.order.notes}</p>
                </div>
              )}
              <div className="border-t border-milk-200/70 px-4 py-3 bg-milk-50/50">
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
