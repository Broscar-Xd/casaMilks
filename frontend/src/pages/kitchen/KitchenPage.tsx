import { useState, useEffect, useCallback, useRef } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Clock, ChefHat, Loader2, CheckCircle, BellRing } from 'lucide-react';
import type { KitchenSend, ApiResponse } from '@/types';

/**
 * Campana de cocina.
 *
 * Los navegadores BLOQUEAN el audio automático (autoplay policy): el elemento
 * <audio> solo puede reproducir DENTRO de un gesto del usuario. Por eso el
 * botón "Probar sonido" suena pero un pedido nuevo (sin gesto) no.
 *
 * Solución robusta — Web Audio API:
 * 1. UN solo AudioContext (singleton).
 * 2. En el primer gesto (botón de prueba o cualquier toque/clic) se REANUDA
 *    el contexto y se carga el WAV decodificado a un buffer.
 * 3. Una vez "running", el contexto reproduce en CUALQUIER momento, sin
 *    necesidad de gesto (no aplica la política de autoplay).
 */
let audioCtx: AudioContext | null = null;
let bellBuffer: AudioBuffer | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Carga el WAV y lo decodifica (una sola vez). */
function loadBellBuffer(ctx: AudioContext) {
  if (bellBuffer) return;
  fetch('/sounds/campana.wav')
    .then((r) => r.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => { bellBuffer = decoded; })
    .catch(() => { /* se usará el fallback de osciladores */ });
}

/** Reanuda el contexto. DEBE llamarse dentro de un gesto del usuario. */
function unlockAudio() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  loadBellBuffer(ctx);
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* silencioso */ });
  }
}

/** Suena la campana. Devuelve false si el audio aún está bloqueado. */
function playBell(): boolean {
  const ctx = getAudioCtx();
  if (!ctx) return false;
  try {
    if (ctx.state !== 'running') {
      // Aún sin gesto del usuario: el navegador lo bloquearía. Intentar reanudar.
      unlockAudio();
      return false;
    }
    if (bellBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = bellBuffer;
      const gain = ctx.createGain();
      gain.gain.value = 1;
      src.connect(gain).connect(ctx.destination);
      src.start();
      return true;
    }
    // Fallback: campana sintetizada con osciladores
    const now = ctx.currentTime;
    const strike = (freq: number, t0: number, vol: number, len: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, now + t0);
      gain.gain.exponentialRampToValueAtTime(vol, now + t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t0 + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + t0);
      osc.stop(now + t0 + len);
    };
    strike(659.25, 0, 0.5, 0.7);
    strike(1046.5, 0.25, 0.4, 1.1);
    return true;
  } catch {
    return false;
  }
}

export default function KitchenPage() {
  const { currentBranch } = useBranch();
  const [sends, setSends] = useState<KitchenSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  // Referencia para detectar pedidos NUEVOS (campana solo cuando llega uno)
  const knownIds = useRef<Set<string>>(new Set());

  // Al montar: el primer gesto del usuario desbloquea el AudioContext (queda
  // "running" para siempre y puede sonar en cualquier momento)
  useEffect(() => {
    const markReady = () => {
      unlockAudio();
      setAudioReady(true);
    };
    window.addEventListener('pointerdown', markReady);
    window.addEventListener('keydown', markReady);
    window.addEventListener('touchstart', markReady);
    return () => {
      window.removeEventListener('pointerdown', markReady);
      window.removeEventListener('keydown', markReady);
      window.removeEventListener('touchstart', markReady);
    };
  }, []);

  const fetchSends = useCallback(async () => {
    if (!currentBranch) return;
    try {
      const res = await api.get<ApiResponse<KitchenSend[]>>(`/orders/kitchen?branchId=${currentBranch.id}`);
      if (res.success && res.data) {
        // En la primera carga solo registramos los IDs (sin sonar la campana)
        const isFirstLoad = knownIds.current.size === 0;
        const newSends = res.data.filter((s) => !knownIds.current.has(s.id));
        if (!isFirstLoad && newSends.length > 0) {
          playBell();
          newSends.forEach((s) => {
            const mesa = s.order?.table?.name || 'Para llevar';
            toast(`🔔 ¡Nuevo pedido a cocina! — ${mesa}`, { duration: 5000, icon: '🔔' });
          });
        }
        // Actualizar el set de IDs conocidos (solo pendientes)
        knownIds.current = new Set(res.data.map((s) => s.id));
        setSends(res.data);
      }
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
      {/* Indicador de audio con botón de prueba */}
      <div className={`mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${audioReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
        <BellRing size={14} />
        <span className="flex-1 min-w-40">
          {audioReady
            ? 'Sonido de campana activado — sonará al llegar un pedido'
            : 'Activa el sonido de campana tocando la pantalla o el botón de prueba'}
        </span>
        <button
          onClick={() => {
            unlockAudio();
            playBell();
            setAudioReady(true);
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${audioReady ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
        >
          🔔 Probar sonido
        </button>
      </div>
      {sends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-milk-100 to-milk-200 shadow-inner mb-5">
            <ChefHat size={56} className="text-cocoa-300" />
          </div>
          <p className="text-2xl font-semibold text-cocoa-400">No hay pedidos pendientes</p>
          <p className="text-base text-cocoa-300 mt-1">Los pedidos aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sends.map((send) => (
            <div key={send.id} className="card overflow-hidden hover:shadow-md hover:shadow-cocoa-900/10 transition-all duration-200 hover:-translate-y-0.5">
              {/* Header tipo ticket */}
              <div className="border-b border-milk-200/70 bg-gradient-to-r from-cocoa-900 to-cocoa-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-milk-50 text-2xl">{send.order?.table?.name || 'Para llevar'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-base text-milk-200">
                    <Clock size={16} />
                    {new Date(send.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              {/* Items */}
              <div className="px-4 py-3 space-y-2">
                {send.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cocoa-500 to-cocoa-700 text-sm font-bold text-milk-50 shadow-sm">{item.quantity}</span>
                    <span className="text-xl font-medium text-cocoa-800">{item.product?.name || 'Producto'}</span>
                  </div>
                ))}
                {/* Combo breakdown */}
                {send.comboItems && send.comboItems.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-milk-200/50 space-y-1.5">
                    {send.comboItems.map(ci => (
                      <div key={ci.id} className="flex items-center gap-2 pl-4">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-milk-400 to-milk-500 text-xs font-bold text-cocoa-900 shadow-sm">{ci.quantity}</span>
                        <span className="text-base text-cocoa-600 font-medium">{ci.productName}</span>
                        {ci.lineLabel && (
                          <span className="text-xs text-cocoa-300 ml-auto italic">{ci.lineLabel}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {send.order?.notes && (
                <div className="mx-4 mb-2 rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2">
                  <p className="text-base text-amber-700"><span className="font-semibold">Nota:</span> {send.order.notes}</p>
                </div>
              )}
              <div className="border-t border-milk-200/70 px-4 py-3 bg-milk-50/50">
                <button onClick={() => markReady(send.id)} className="btn-success w-full py-2.5 text-base">
                  <CheckCircle size={18} /> Marcar como Listo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
