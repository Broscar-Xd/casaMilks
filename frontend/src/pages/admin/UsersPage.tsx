import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useBranch } from '@/contexts/BranchContext';
import toast from 'react-hot-toast';
import { Plus, Pencil, Loader2, Store } from 'lucide-react';
import type { User, Branch, ApiResponse } from '@/types';

export default function UsersPage() {
  const { branches } = useBranch();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' as string, branchId: '' });

  const fetchData = async () => {
    try {
      const res = await api.get<ApiResponse<User[]>>('/users');
      if (res.success && res.data) setUsers(res.data);
    } catch { toast.error('Error al cargar usuarios'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'STAFF', branchId: '' });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, branchId: user.branchId || '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email) { toast.error('Nombre y email requeridos'); return; }
    if (!editing && !form.password) { toast.error('Contraseña requerida'); return; }
    try {
      if (editing) {
        const payload: any = { name: form.name, email: form.email, role: form.role, branchId: form.branchId || null };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editing.id}`, payload);
        toast.success('Usuario actualizado');
      } else {
        await api.post('/users', form);
        toast.success('Usuario creado');
      }
      setShowModal(false);
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al guardar'); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-xs text-gray-500">{users.length} usuarios registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nuevo Usuario</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-50/80">
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header">Email</th>
              <th className="table-header text-center">Rol</th>
              <th className="table-header text-center">Estado</th>
              <th className="table-header text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {users.map((user) => (
              <tr key={user.id} className="table-row">
                <td className="table-cell font-medium text-surface-900">{user.name}</td>
                <td className="table-cell text-surface-400">{user.email}</td>
                <td className="table-cell text-center">
                  <span className={`badge ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                    {user.role === 'ADMIN' ? 'Admin' : 'Personal'}
                  </span>
                </td>
                <td className="table-cell text-center">
                  <span className={`inline-flex h-2 w-2 rounded-full ${user.active ? 'bg-green-500' : 'bg-red-500'}`} />
                </td>
                <td className="table-cell text-right">
                  <button onClick={() => openEdit(user)} className="btn-ghost p-1.5"><Pencil size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-md modal-content mx-2 sm:mx-0">
            <div className="border-b border-surface-100 px-6 py-4"><h2 className="text-lg font-semibold">{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</h2></div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">{editing ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña'}</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Rol</label>
                  <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="STAFF">Personal</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="label">Local</label>
                  <select className="input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
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
