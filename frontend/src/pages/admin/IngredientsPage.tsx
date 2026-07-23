import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import type { Ingredient, ApiResponse } from '@/types';

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({ name: '', unit: 'unidad', minStock: 0 });

  const fetchData = async () => {
    try {
      const res = await api.get<ApiResponse<Ingredient[]>>('/ingredients');
      if (res.success && res.data) setIngredients(res.data);
    } catch {
      toast.error('Error al cargar insumos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', unit: 'unidad', minStock: 0 });
    setShowModal(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditing(ing);
    setForm({ name: ing.name, unit: ing.unit, minStock: Number(ing.minStock) });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Nombre requerido'); return; }
    try {
      if (editing) {
        await api.patch(`/ingredients/${editing.id}`, form);
        toast.success('Insumo actualizado');
      } else {
        await api.post('/ingredients', form);
        toast.success('Insumo creado');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Insumos</h1>
          <p className="text-xs text-gray-500">{ingredients.length} insumos registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nuevo Insumo</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-50/80">
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header">Unidad</th>
              <th className="table-header text-right">Stock Mínimo</th>
              <th className="table-header text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {ingredients.map((ing) => (
              <tr key={ing.id} className="table-row">
                <td className="table-cell font-medium text-surface-900">{ing.name}</td>
                <td className="table-cell text-surface-400">{ing.unit}</td>
                <td className="table-cell text-right">{Number(ing.minStock)}</td>
                <td className="table-cell text-right">
                  <button onClick={() => openEdit(ing)} className="btn-ghost p-1.5"><Pencil size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-md modal-content">
            <div className="border-b border-surface-100 px-6 py-4"><h2 className="text-lg font-semibold">{editing ? 'Editar Insumo' : 'Nuevo Insumo'}</h2></div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Unidad</label>
                  <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    <option value="unidad">Unidad</option>
                    <option value="kg">Kilogramo</option>
                    <option value="g">Gramo</option>
                    <option value="l">Litro</option>
                    <option value="ml">Mililitro</option>
                    <option value="lb">Libra</option>
                  </select>
                </div>
                <div>
                  <label className="label">Stock Mínimo</label>
                  <input type="number" min="0" className="input" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t border-surface-100 px-6 py-4">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSubmit} className="btn-primary flex-1">{editing ? 'Actualizar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
