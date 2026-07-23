import { useState, useEffect } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Loader2, AlertTriangle, Plus, Minus, History } from 'lucide-react';
import type { InventoryItem, ApiResponse, Ingredient } from '@/types';

export default function InventoryPage() {
  const { currentBranch } = useBranch();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ ingredientId: '', quantity: 0, notes: '' });
  const [showMovements, setShowMovements] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);

  const fetchData = async () => {
    if (!currentBranch) return;
    try {
      const [invRes, ingRes] = await Promise.all([
        api.get<ApiResponse<InventoryItem[]>>(`/inventory?branchId=${currentBranch.id}`),
        api.get<ApiResponse<Ingredient[]>>('/ingredients'),
      ]);
      if (invRes.success && invRes.data) setItems(invRes.data);
      if (ingRes.success && ingRes.data) setIngredients(ingRes.data);
    } catch {
      toast.error('Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentBranch]);

  const lowStock = items.filter((item) => Number(item.quantity) <= Number(item.ingredient.minStock));

  const handleAdjust = async () => {
    if (!adjustForm.ingredientId) { toast.error('Selecciona un insumo'); return; }
    try {
      await api.post('/inventory/adjust', {
        ingredientId: adjustForm.ingredientId,
        branchId: currentBranch!.id,
        quantity: adjustForm.quantity,
        notes: adjustForm.notes,
      });
      toast.success('Inventario ajustado');
      setShowAdjust(false);
      setAdjustForm({ ingredientId: '', quantity: 0, notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al ajustar');
    }
  };

  const viewMovements = async () => {
    if (!currentBranch) return;
    try {
      const res = await api.get<ApiResponse<any[]>>(`/inventory/movements?branchId=${currentBranch.id}`);
      if (res.success && res.data) setMovements(res.data);
      setShowMovements(true);
    } catch {
      toast.error('Error al cargar movimientos');
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  if (!currentBranch) return <div className="flex h-64 items-center justify-center"><p className="text-gray-500">Selecciona un local</p></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
          <p className="text-xs text-gray-500">{currentBranch.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={viewMovements} className="btn-secondary"><History size={16} /> Movimientos</button>
          <button onClick={() => setShowAdjust(true)} className="btn-primary"><Plus size={16} /> Ajustar Stock</button>
        </div>
      </div>

      {/* Alertas */}
      {lowStock.length > 0 && (
        <div className="mb-6 card p-4 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle size={20} />
            <span className="font-medium">Alertas de stock bajo</span>
          </div>
          <ul className="mt-2 space-y-1">
            {lowStock.map((item) => (
              <li key={item.id} className="text-sm text-yellow-700">
                {item.ingredient.name}: {Number(item.quantity)} {item.ingredient.unit} (mínimo: {Number(item.ingredient.minStock)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-50/80">
            <tr>
              <th className="table-header">Insumo</th>
              <th className="table-header">Unidad</th>
              <th className="table-header text-right">Stock Actual</th>
              <th className="table-header text-right">Stock Mínimo</th>
              <th className="table-header text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {items.map((item) => {
              const qty = Number(item.quantity);
              const min = Number(item.ingredient.minStock);
              return (
                <tr key={item.id} className="table-row">
                  <td className="table-cell font-medium text-surface-900">{item.ingredient.name}</td>
                  <td className="table-cell text-surface-400">{item.ingredient.unit}</td>
                  <td className="table-cell text-right font-medium text-surface-900">{qty}</td>
                  <td className="table-cell text-right">{min}</td>
                  <td className="table-cell text-center">
                    {qty <= 0 ? (
                      <span className="badge bg-red-100 text-red-800">Sin stock</span>
                    ) : qty <= min ? (
                      <span className="badge bg-yellow-100 text-yellow-800">Bajo</span>
                    ) : (
                      <span className="badge bg-green-100 text-green-800">Ok</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Ajuste */}
      {showAdjust && (
        <div className="modal-overlay">
          <div className="w-full max-w-md modal-content">
            <div className="border-b border-surface-100 px-6 py-4"><h2 className="text-lg font-semibold">Ajustar Stock</h2></div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="label">Insumo</label>
                <select className="input" value={adjustForm.ingredientId} onChange={(e) => setAdjustForm({ ...adjustForm, ingredientId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Cantidad (usar negativo para reducir)</label>
                <input type="number" className="input" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Notas</label>
                <input className="input" value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 border-t border-surface-100 px-6 py-4">
              <button onClick={() => setShowAdjust(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleAdjust} className="btn-primary flex-1">Ajustar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Movimientos */}
      {showMovements && (
        <div className="modal-overlay">
          <div className="w-full max-w-2xl max-h-[80vh] modal-content overflow-hidden">
            <div className="border-b border-surface-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Historial de Movimientos</h2>
              <button onClick={() => setShowMovements(false)} className="btn-ghost p-1">✕</button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="bg-surface-50/80">
                  <tr>
                    <th className="table-header">Insumo</th>
                    <th className="table-header text-center">Tipo</th>
                    <th className="table-header text-right">Cantidad</th>
                    <th className="table-header">Referencia</th>
                    <th className="table-header text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {movements.map((m: any) => (
                    <tr key={m.id} className="table-row">
                      <td className="table-cell">{m.ingredient?.name || '—'}</td>
                      <td className="table-cell text-center">
                        <span className={`badge ${m.type === 'IN' ? 'bg-green-100 text-green-800' : m.type === 'OUT' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          {m.type === 'IN' ? 'Entrada' : m.type === 'OUT' ? 'Salida' : 'Ajuste'}
                        </span>
                      </td>
                      <td className="table-cell text-right font-medium text-surface-900">{Number(m.quantity)}</td>
                      <td className="table-cell text-surface-400">{m.reference || '—'}</td>
                      <td className="table-cell text-right text-surface-400">{new Date(m.createdAt).toLocaleString('es-EC')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
