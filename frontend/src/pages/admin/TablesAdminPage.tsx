import { useState, useEffect } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { TableItem, ApiResponse } from '@/types';

export default function TablesAdminPage() {
  const { branches } = useBranch();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TableItem | null>(null);
  const [form, setForm] = useState({ name: '', branchId: '' });

  const fetchData = async () => {
    const branchId = form.branchId || branches[0]?.id;
    if (!branchId) { setLoading(false); return; }
    try {
      const res = await api.get<ApiResponse<TableItem[]>>(`/tables?branchId=${branchId}`);
      if (res.success && res.data) setTables(res.data);
    } catch { toast.error('Error al cargar mesas'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (branches.length > 0) { setForm(f => ({ ...f, branchId: branches[0].id })); fetchData(); } }, [branches]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', branchId: branches[0]?.id || '' });
    setShowModal(true);
  };

  const openEdit = (table: TableItem) => {
    setEditing(table);
    setForm({ name: table.name, branchId: table.branchId });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Nombre requerido'); return; }
    try {
      if (editing) {
        await api.patch(`/tables/${editing.id}`, { name: form.name });
        toast.success('Mesa actualizada');
      } else {
        await api.post('/tables', form);
        toast.success('Mesa creada');
      }
      setShowModal(false);
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
  };

  const handleDelete = async (table: TableItem) => {
    if (!confirm(`¿Eliminar ${table.name}?`)) return;
    try {
      await api.delete(`/tables/${table.id}`);
      toast.success('Mesa eliminada');
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold text-gray-900">Mesas</h1><p className="text-xs text-gray-500">{tables.length} mesas</p></div>
        <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nueva Mesa</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-50/80">
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header text-center">Estado</th>
              <th className="table-header text-center">Activa</th>
              <th className="table-header text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {tables.map(table => (
              <tr key={table.id} className="table-row">
                <td className="table-cell font-medium text-surface-900">{table.name}</td>
                <td className="table-cell text-center">
                  <span className={`badge ${table.status === 'FREE' ? 'bg-green-100 text-green-800' : table.status === 'OCCUPIED' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                    {table.status === 'FREE' ? 'Libre' : table.status === 'OCCUPIED' ? 'Ocupada' : 'Pendiente de cobro'}
                  </span>
                </td>
                <td className="table-cell text-center"><span className={`inline-flex h-2 w-2 rounded-full ${table.active ? 'bg-green-500' : 'bg-red-500'}`} /></td>
                <td className="table-cell text-right">
                  <button onClick={() => openEdit(table)} className="btn-ghost p-1.5"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(table)} className="btn-ghost p-1.5 text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-md modal-content mx-2 sm:mx-0">
            <div className="border-b border-surface-100 px-6 py-4"><h2 className="text-lg font-semibold">{editing ? 'Editar Mesa' : 'Nueva Mesa'}</h2></div>
            <div className="space-y-4 px-6 py-4">
              <div><label className="label">Nombre de mesa</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              {!editing && <div><label className="label">Local</label><select className="input" value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>}
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
