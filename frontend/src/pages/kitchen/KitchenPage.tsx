import { useState, useEffect, useCallback, useRef } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Clock, ChefHat, Loader2, CheckCircle, BellRing, Pencil, Trash2, Minus, Plus, Layers, X } from 'lucide-react';
import type { KitchenSend, KitchenSendItem, ComboLine, ApiResponse } from '@/types';

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

  // ---- Edición de items desde cocina ----
  const [editingItem, setEditingItem] = useState<{ send: KitchenSend; item: KitchenSendItem } | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editLines, setEditLines] = useState<ComboLine[]>([]);
  const [editSelections, setEditSelections] = useState<Record<string, string[]>>({});
  const [editLoading, setEditLoading] = useState(false);
  // Confirmación de eliminación (modal)
  const [confirmDelete, setConfirmDelete] = useState<{ send: KitchenSend; item: KitchenSendItem } | null>(null);

  const openEditItem = async (send: KitchenSend, item: KitchenSendItem) => {
    setEditingItem({ send, item });
    setEditQty(item.quantity);
    setEditLines([]);
    setEditSelections({});
    // Si es combo, cargar sus opciones y marcar las seleccionadas
    if (item.product?.category?.isCombo && item.product?.categoryId) {
      try {
        const res = await api.get<ApiResponse<ComboLine[]>>(`/categories/${item.product.categoryId}/combos`);
        if (res.success && res.data) {
          setEditLines(res.data);
          const init: Record<string, string[]> = {};
          res.data.forEach(line => {
            init[line.id] = (item.comboItems || [])
              .filter(c => c.lineLabel === line.label)
              .map(c => c.productId);
          });
          setEditSelections(init);
        }
      } catch {
        /* el modal sigue funcionando solo con cantidad */
      }
    }
  };

  const toggleEditSelection = (lineId: string, productId: string, maxSelect: number) => {
    setEditSelections(prev => {
      const current = prev[lineId] || [];
      if (current.includes(productId)) {
        return { ...prev, [lineId]: current.filter(id => id !== productId) };
      }
      if (current.length >= maxSelect) {
        toast.error(`Máximo ${maxSelect} selecciones`);
        return prev;
      }
      return { ...prev, [lineId]: [...current, productId] };
    });
  };

  const saveEditItem = async () => {
    const editing = editingItem;
    const orderId = editing?.send.order?.id;
    const orderItemId = editing?.item.orderItemId;
    if (!orderId || !orderItemId) {
      toast.error('Este producto no se puede editar desde cocina (se envió antes de la actualización). Edítalo desde el POS.');
      return;
    }
    const { send, item } = editing;
    // Validar líneas requeridas
    for (const line of editLines) {
      const selected = editSelections[line.id] || [];
      if (line.required && selected.length < line.minSelect) {
        toast.error(`Selecciona al menos ${line.minSelect} en "${line.label}"`);
        return;
      }
    }
    const selections: Array<{ productId: string; productName: string; lineLabel: string }> = [];
    for (const line of editLines) {
      for (const pid of editSelections[line.id] || []) {
        const lp = line.comboLineProducts?.find(clp => clp.productId === pid)?.product;
        if (lp) selections.push({ productId: lp.id, productName: lp.name, lineLabel: line.label });
      }
    }
    setEditLoading(true);
    try {
      const body: Record<string, unknown> = { quantity: editQty };
      if (editLines.length > 0) body.comboSelections = selections;
      const res = await api.patch<ApiResponse<KitchenSend>>(`/orders/${orderId}/items/${orderItemId}`, body);
      if (res.success) {
        toast.success('Item actualizado');
        setEditingItem(null);
        fetchSends();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally { setEditLoading(false); }
  };

  /** Abre el modal de confirmación para eliminar un item desde cocina. */
  const askDeleteSendItem = (send: KitchenSend, item: KitchenSendItem) => {
    setConfirmDelete({ send, item });
  };

  /** Ejecuta la eliminación confirmada en el modal. */
  const confirmDeleteSendItem = async () => {
    const cd = confirmDelete;
    if (!cd) return;
    const { send, item } = cd;
    const orderId = send.order?.id;
    const orderItemId = item.orderItemId;
    setConfirmDelete(null);
    if (!orderId || !orderItemId) {
      toast.error('Este producto no se puede eliminar desde cocina (se envió antes de la actualización). Elimínalo desde el POS.');
      return;
    }
    try {
      const res = await api.delete<ApiResponse<KitchenSend>>(`/orders/${orderId}/items/${orderItemId}`);
      if (res.success) {
        toast.success('Producto eliminado');
        fetchSends();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
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
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cocoa-500 to-cocoa-700 text-sm font-bold text-milk-50 shadow-sm">{item.quantity}</span>
                      <span className="text-xl font-medium leading-tight text-cocoa-800 flex-1 min-w-0 break-words">{item.product?.name || 'Producto'}</span>
                      <button
                        onClick={() => openEditItem(send, item)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-milk-100 text-cocoa-500 hover:bg-milk-200 hover:text-cocoa-700 transition-colors"
                        title="Editar (cantidad o elecciones del combo)"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => askDeleteSendItem(send, item)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Eliminar del pedido"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {/* Selecciones del combo, anidadas debajo de su combo padre */}
                    {item.comboItems && item.comboItems.length > 0 && (
                      <div className="space-y-1.5 border-l-2 border-milk-300 ml-4 pl-3 mt-1.5">
                        {item.comboItems.map(ci => (
                          <div key={ci.id} className="flex items-center gap-2">
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
                ))}
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

      {/* MODAL: Editar item desde cocina */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="w-full max-w-lg modal-content max-h-[90vh] flex flex-col mx-2 sm:mx-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-milk-200/70 px-6 py-4 shrink-0 bg-gradient-to-r from-milk-50/60 to-transparent rounded-t-3xl">
              <h2 className="text-base font-semibold text-cocoa-900 flex items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-gradient-to-b from-cocoa-500 to-cocoa-700" />
                Editar {editingItem.item.product?.name || 'Producto'}
              </h2>
              <button onClick={() => setEditingItem(null)} className="btn-ghost p-1.5 rounded-xl hover:bg-milk-100"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Cantidad */}
              <div className="flex items-center gap-3 rounded-xl bg-cocoa-50/50 border border-cocoa-200/60 p-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cocoa-500 to-cocoa-700 text-milk-50 font-bold shadow-md">
                  <Layers size={20} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-cocoa-900">{editingItem.item.product?.name || 'Producto'}</p>
                  <p className="text-xs text-cocoa-400">Cantidad</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setEditQty(q => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-milk-200 text-cocoa-600 hover:bg-milk-100 transition-colors"><Minus size={16} /></button>
                  <span className="w-8 text-center font-bold text-cocoa-900 text-lg">{editQty}</span>
                  <button onClick={() => setEditQty(q => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-milk-200 text-cocoa-600 hover:bg-milk-100 transition-colors"><Plus size={16} /></button>
                </div>
              </div>

              {/* Elecciones del combo */}
              {editLines.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-gradient-to-b from-cocoa-400 to-cocoa-600" />
                    <p className="text-sm font-semibold text-cocoa-900">Elecciones del combo</p>
                  </div>
                  {editLines.map(line => (
                    <div key={line.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-cocoa-800">{line.label}</p>
                        {line.required && <span className="text-[10px] text-red-500 font-medium">*Requerido</span>}
                        <span className="text-[10px] text-cocoa-300 ml-auto">
                          {line.minSelect === line.maxSelect
                            ? `Selecciona ${line.minSelect}`
                            : `Min ${line.minSelect} · Max ${line.maxSelect}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(line.comboLineProducts || []).map(clp => {
                          const opt = clp.product;
                          const isSelected = (editSelections[line.id] || []).includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleEditSelection(line.id, opt.id, line.maxSelect)}
                              className={`relative flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150 ${
                                isSelected
                                  ? 'border-cocoa-500 bg-cocoa-50 shadow-md shadow-cocoa-500/20'
                                  : 'border-milk-200 bg-white hover:border-cocoa-300 hover:shadow-sm'
                              }`}
                            >
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                                isSelected ? 'bg-cocoa-600 text-milk-50' : 'bg-milk-100 text-cocoa-400'
                              }`}>
                                {isSelected ? '✓' : ''}
                              </span>
                              <span className={`text-sm font-medium ${isSelected ? 'text-cocoa-900' : 'text-cocoa-600'}`}>
                                {opt.name}
                              </span>
                            </button>
                          );
                        })}
                        {(line.comboLineProducts || []).length === 0 && (
                          <p className="text-xs text-cocoa-300 col-span-full text-center py-3">Sin opciones disponibles</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-milk-200/70 px-6 py-4 shrink-0 flex gap-3">
              <button onClick={() => setEditingItem(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={saveEditItem} disabled={editLoading} className="btn-primary flex-1">
                {editLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar eliminación de producto */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm modal-content mx-2 sm:mx-0 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500">
                <Trash2 size={20} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-cocoa-900">Eliminar producto</h2>
                <p className="text-xs text-cocoa-400">
                  {confirmDelete.send.order?.table?.name || 'Para llevar'}
                </p>
              </div>
            </div>
            <p className="text-sm text-cocoa-600 leading-relaxed">
              ¿Eliminar <span className="font-semibold text-cocoa-800">"{confirmDelete.item.product?.name || 'Producto'}"</span> del pedido?<br />
              <span className="text-xs text-cocoa-400">Se quitará también de la cuenta y del total.</span>
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={confirmDeleteSendItem} className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
