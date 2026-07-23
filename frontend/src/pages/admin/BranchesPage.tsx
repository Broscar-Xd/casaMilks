import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Loader2, Settings2 } from 'lucide-react';
import type { Branch, ApiResponse } from '@/types';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFiscal, setShowFiscal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [fiscalForm, setFiscalForm] = useState({
    ruc: '', businessName: '', tradeName: '', receiptAuthorization: '',
    rimpeLegend: 'Contribuyente RIMPE Negocio Popular', address: '', phone: '', email: '',
  });

  const fetchData = async () => {
    try {
      const res = await api.get<ApiResponse<Branch[]>>('/branches');
      if (res.success && res.data) setBranches(res.data);
    } catch { toast.error('Error al cargar locales'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', address: '', phone: '' });
    setShowModal(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setForm({ name: branch.name, address: branch.address, phone: branch.phone || '' });
    setShowModal(true);
  };

  const openFiscalConfig = (branch: Branch) => {
    setSelectedBranch(branch);
    if (branch.fiscalConfig) {
      setFiscalForm({
        ruc: branch.fiscalConfig.ruc,
        businessName: branch.fiscalConfig.businessName,
        tradeName: branch.fiscalConfig.tradeName,
        receiptAuthorization: branch.fiscalConfig.receiptAuthorization,
        rimpeLegend: branch.fiscalConfig.rimpeLegend,
        address: branch.fiscalConfig.address,
        phone: branch.phone || '',
        email: '',
      });
    } else {
      setFiscalForm({
        ruc: '', businessName: '', tradeName: '', receiptAuthorization: '',
        rimpeLegend: 'Contribuyente RIMPE Negocio Popular', address: branch.address, phone: branch.phone || '', email: '',
      });
    }
    setShowFiscal(true);
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Nombre requerido'); return; }
    try {
      if (editing) {
        await api.patch(`/branches/${editing.id}`, form);
        toast.success('Local actualizado');
      } else {
        await api.post('/branches', form);
        toast.success('Local creado');
      }
      setShowModal(false);
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al guardar'); }
  };

  const handleFiscalSubmit = async () => {
    if (!selectedBranch) return;
    try {
      await api.put(`/branches/${selectedBranch.id}/fiscal-config`, fiscalForm);
      toast.success('Configuración fiscal actualizada');
      setShowFiscal(false);
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al guardar'); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Locales</h1>
          <p className="text-xs text-gray-500">{branches.length} locales registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nuevo Local</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => (
          <div key={branch.id} className="card-hover p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                <p className="text-sm text-gray-500">{branch.address}</p>
              </div>
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${branch.active ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            {branch.phone && <p className="text-sm text-gray-500">📞 {branch.phone}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => openEdit(branch)} className="btn-ghost flex-1 text-xs"><Pencil size={14} /> Editar</button>
              <button onClick={() => openFiscalConfig(branch)} className="btn-ghost flex-1 text-xs"><Settings2 size={14} /> SRI</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Local */}
      {showModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-md modal-content mx-2 sm:mx-0">
            <div className="border-b border-surface-100 px-6 py-4"><h2 className="text-lg font-semibold">{editing ? 'Editar Local' : 'Nuevo Local'}</h2></div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 border-t border-surface-100 px-6 py-4">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSubmit} className="btn-primary flex-1">{editing ? 'Actualizar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuración Fiscal */}
      {showFiscal && selectedBranch && (
        <div className="modal-overlay">
          <div className="w-full max-w-lg modal-content max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
            <div className="border-b border-surface-100 px-6 py-4">
              <h2 className="text-lg font-semibold">Configuración Fiscal - SRI</h2>
              <p className="text-sm text-gray-500">{selectedBranch.name}</p>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="label">RUC</label>
                <input className="input" maxLength={13} value={fiscalForm.ruc} onChange={(e) => setFiscalForm({ ...fiscalForm, ruc: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Razón Social</label>
                  <input className="input" value={fiscalForm.businessName} onChange={(e) => setFiscalForm({ ...fiscalForm, businessName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Nombre Comercial</label>
                  <input className="input" value={fiscalForm.tradeName} onChange={(e) => setFiscalForm({ ...fiscalForm, tradeName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Autorización</label>
                <input className="input" value={fiscalForm.receiptAuthorization} onChange={(e) => setFiscalForm({ ...fiscalForm, receiptAuthorization: e.target.value })} />
              </div>
              <div>
                <label className="label">Leyenda RIMPE</label>
                <input className="input" value={fiscalForm.rimpeLegend} onChange={(e) => setFiscalForm({ ...fiscalForm, rimpeLegend: e.target.value })} />
              </div>
              <div>
                <label className="label">Dirección (fiscal)</label>
                <input className="input" value={fiscalForm.address} onChange={(e) => setFiscalForm({ ...fiscalForm, address: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 border-t border-surface-100 px-6 py-4">
              <button onClick={() => setShowFiscal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleFiscalSubmit} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
