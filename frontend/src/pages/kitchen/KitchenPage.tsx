import { useState, useEffect, useCallback, useRef } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Clock, ChefHat, Loader2, CheckCircle, BellRing } from 'lucide-react';
import type { KitchenSend, ApiResponse } from '@/types';

/**
 * Campana de cocina.
 *
 * Los navegadores BLOQUEAN el audio automático (autoplay policy) hasta que el
 * usuario interactúa con la página. Estrategia a prueba de balas:
 * 1. UN solo AudioContext (singleton) + un elemento <audio> de respaldo.
 * 2. En el primer gesto (botón de prueba o cualquier toque/clic) se REANUDA
 *    el contexto y se carga el WAV decodificado a un buffer.
 * 3. Al llegar un pedido: si el contexto está suspendido, se reanuda y LUEGO
 *    se reproduce (await resume → play). Se reintenta varias veces y, si el
 *    AudioContext no pudo, se usa el <audio> como respaldo.
 * 4. Además hay una ALARMA VISUAL (banner rojo parpadeante) + vibración en
 *    Android, para que la notificación nunca se pierda aunque el sonido
 *    esté bloqueado por el navegador.
 */
let audioCtx: AudioContext | null = null;
let bellBuffer: AudioBuffer | null = null;
let bellAudioEl: HTMLAudioElement | null = null;

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

function getBellAudioEl(): HTMLAudioElement | null {
  try {
    if (!bellAudioEl) {
      const a = new Audio('/sounds/campana.wav');
      a.preload = 'auto';
      bellAudioEl = a;
    }
    return bellAudioEl;
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
  // También "desbloquear" el elemento <audio> de respaldo: reproducir y pausar
  // dentro del gesto hace que futuros play() (sin gesto) sean permitidos.
  const el = getBellAudioEl();
  if (el) {
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.then(() => { el.pause(); el.currentTime = 0; }).catch(() => { /* silencioso */ });
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* silencioso */ });
  }
}

/** Suena la campana (WAV o fallback osciladores). Reanuda primero si hace falta. */
async function playBell(): Promise<boolean> {
  const ctx = getAudioCtx();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
      const stateAfter = (ctx as any).state as string;
      if (stateAfter !== 'running') return false;
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

/** Respaldo con el elemento <audio> (puede fallar sin gesto previo). */
function playBellElement(): boolean {
  const el = getBellAudioEl();
  if (!el) return false;
  try {
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Intenta sonar con varias estrategias y reintentos. */
async function ringBell() {
  for (let i = 0; i < 3; i++) {
    if (await playBell()) return;
    playBellElement();
    await new Promise((r) => setTimeout(r, 400));
  }
}

export default function KitchenPage() {
  const { currentBranch } = useBranch();
  const [sends, setSends] = useState<KitchenSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  // Alarma visual: banner rojo parpadeante al llegar un pedido
  const [alarm, setAlarm] = useState<{ key: number; label: string } | null>(null);
  // Referencia para detectar pedidos NUEVOS (campana solo cuando llega uno)
  const knownIds = useRef<Set<string>>(new Set());

  // La alarma visual desaparece sola a los 6s
  useEffect(() => {
    if (!alarm) return;
    const t = setTimeout(() => setAlarm(null), 6000);
    return () => clearTimeout(t);
  }, [alarm]);

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
          // Alarma VISUAL garantizada (banner rojo) + vibración en Android
          const mesas = newSends.map((s) => s.order?.table?.name || 'Para llevar').join(', ');
          setAlarm({ key: Date.now(), label: `Mesa(s): ${mesas}` });
          if (typeof navigator.vibrate === 'function') {
            navigator.vibrate([300, 120, 300]);
          }
          // Sonido con reintentos
          ringBell();
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
            ringBell();
            setAudioReady(true);
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${audioReady ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
        >
          🔔 Probar sonido
        </button>
      </div>

      {/* ALARMA VISUAL: pedido nuevo (parpadea 6s, nunca se pierde aunque no haya sonido) */}
      {alarm && (
        <div key={alarm.key} className="mb-4 flex items-center gap-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 shadow-lg animate-pulse">
          <BellRing size={24} className="text-red-500 animate-bounce" />
          <div>
            <p className="text-sm font-bold text-red-600">🔔 ¡Nuevo pedido a cocina!</p>
            <p className="text-xs text-red-500">{alarm.label}</p>
          </div>
        </div>
      )}
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
