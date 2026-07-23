import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import type { Category, ApiResponse } from '@/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const fetchData = async () => {
    try {
      const res = await api.get<ApiResponse<Category[]>>('/categories/all');
      if (res.success && res.data) setCategories(res.data);
    } catch {
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Nombre requerido'); return; }
    try {
      if (editing) {
        await api.patch(`/categories/${editing.id}`, form);
        toast.success('Categoría actualizada');
      } else {
        await api.post('/categories', form);
        toast.success('Categoría creada');
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
          <h1 className="text-xl font-bold text-gray-900">Categorías</h1>
          <p className="text-xs text-gray-500">{categories.length} categorías</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nueva Categoría</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-50/80">
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header">Descripción</th>
              <th className="table-header text-center">Activo</th>
              <th className="table-header text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {categories.map((cat) => (
              <tr key={cat.id} className="table-row">
                <td className="table-cell font-medium text-surface-900">{cat.name}</td>
                <td className="table-cell text-surface-400">{cat.description || '—'}</td>
                <td className="table-cell text-center">
                  <span className={`inline-flex h-2 w-2 rounded-full ${cat.active ? 'bg-green-500' : 'bg-red-500'}`} />
                </td>
                <td className="table-cell text-right">
                  <button onClick={() => openEdit(cat)} className="btn-ghost p-1.5"><Pencil size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-md modal-content">
            <div className="border-b border-surface-100 px-6 py-4"><h2 className="text-lg font-semibold">{editing ? 'Editar Categoría' : 'Nueva Categoría'}</h2></div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
