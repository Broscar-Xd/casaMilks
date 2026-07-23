import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useBranch } from '@/contexts/BranchContext';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Pencil, Loader2, Search, ChefHat } from 'lucide-react';
import type { Product, Category, ApiResponse } from '@/types';

export default function ProductsPage() {
  const { currentBranch } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: 0, categoryId: '', branchId: '', requiresPreparation: true });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          api.get<ApiResponse<Product[]>>('/products/all'),
          api.get<ApiResponse<Category[]>>('/categories/all'),
        ]);
        if (prodRes.success && prodRes.data) setProducts(prodRes.data);
        if (catRes.success && catRes.data) setCategories(catRes.data);
      } catch {
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: 0, categoryId: categories[0]?.id || '', branchId: currentBranch?.id || '', requiresPreparation: true });
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price: Number(product.price),
      categoryId: product.categoryId,
      branchId: product.branchId,
      requiresPreparation: product.requiresPreparation ?? true,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name || form.price <= 0) {
      toast.error('Nombre y precio son requeridos');
      return;
    }

    try {
      if (editing) {
        await api.patch(`/products/${editing.id}`, form);
        toast.success('Producto actualizado');
      } else {
        await api.post('/products', form);
        toast.success('Producto creado');
      }
      setShowModal(false);
      // Recargar
      const res = await api.get<ApiResponse<Product[]>>('/products/all');
      if (res.success && res.data) setProducts(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Productos</h1>
          <p className="text-xs text-gray-500">{products.length} productos registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              className="input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50/80">
              <tr>
                <th className="table-header">Nombre</th>
                <th className="table-header">Categoría</th>
                <th className="table-header text-right">Precio</th>
                <th className="table-header text-center">Cocina</th>
                <th className="table-header text-center">Activo</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((product) => (
                <tr key={product.id} className="table-row">
                  <td className="table-cell font-medium text-surface-900">{product.name}</td>
                  <td className="table-cell text-surface-400">{product.category?.name || '—'}</td>
                  <td className="table-cell text-right font-medium text-surface-900">{formatCurrency(Number(product.price))}</td>
                  <td className="table-cell text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${product.requiresPreparation !== false ? 'text-orange-600' : 'text-gray-400'}`}>
                      <ChefHat size={14} />
                      {product.requiresPreparation !== false ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="table-cell text-center">
                    <span className={`inline-flex h-2 w-2 rounded-full ${product.active ? 'bg-green-500' : 'bg-red-500'}`} />
                  </td>
                  <td className="table-cell text-right">
                    <button onClick={() => openEdit(product)} className="btn-ghost p-1.5">
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-md modal-content">
            <div className="border-b border-surface-100 px-6 py-4">
              <h2 className="text-lg font-semibold">{editing ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Precio</label>
                  <input type="number" step="0.01" min="0" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">¿Enviar a Cocina?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="requiresPreparation" checked={form.requiresPreparation !== false}
                      onChange={() => setForm({ ...form, requiresPreparation: true })}
                      className="text-brand-500 focus:ring-brand-500" />
                    <span className="text-sm text-gray-700">Sí</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="requiresPreparation" checked={form.requiresPreparation === false}
                      onChange={() => setForm({ ...form, requiresPreparation: false })}
                      className="text-brand-500 focus:ring-brand-500" />
                    <span className="text-sm text-gray-700">No</span>
                  </label>
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
