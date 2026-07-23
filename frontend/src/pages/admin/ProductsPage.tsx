import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useBranch } from '@/contexts/BranchContext';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Pencil, Loader2, Search, ChefHat, Trash2, PlusCircle } from 'lucide-react';
import type { Product, Category, Ingredient, ApiResponse } from '@/types';

export default function ProductsPage() {
  const { currentBranch } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: 0, categoryId: '', branchId: '', requiresPreparation: true });
  const [productRecipes, setProductRecipes] = useState<Array<{ ingredientId: string; ingredientName: string; quantity: number }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes, ingRes] = await Promise.all([
          api.get<ApiResponse<Product[]>>('/products/all'),
          api.get<ApiResponse<Category[]>>('/categories/all'),
          api.get<ApiResponse<Ingredient[]>>('/ingredients'),
        ]);
        if (prodRes.success && prodRes.data) setProducts(prodRes.data);
        if (catRes.success && catRes.data) setCategories(catRes.data);
        if (ingRes.success && ingRes.data) setIngredients(ingRes.data);
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
    setProductRecipes([]);
    setShowModal(true);
  };

  const openEdit = async (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price: Number(product.price),
      categoryId: product.categoryId,
      branchId: product.branchId,
      requiresPreparation: product.requiresPreparation ?? true,
    });

    // Cargar receta existente
    try {
      const res = await api.get<ApiResponse<Array<{ id: string; ingredientId: string; quantity: number; ingredient: Ingredient }>>>(`/recipes/product/${product.id}`);
      if (res.success && res.data) {
        setProductRecipes(
          res.data.map((r) => ({
            ingredientId: r.ingredientId,
            ingredientName: r.ingredient?.name || '',
            quantity: Number(r.quantity),
          }))
        );
      }
    } catch {
      setProductRecipes([]);
    }

    setShowModal(true);
  };

  const addRecipeRow = () => {
    const first = ingredients[0];
    if (!first) return;
    setProductRecipes((prev) => [...prev, { ingredientId: first.id, ingredientName: first.name, quantity: 1 }]);
  };

  const updateRecipe = (index: number, field: string, value: string | number) => {
    setProductRecipes((prev) => {
      const next = [...prev];
      if (field === 'ingredientId') {
        const ing = ingredients.find((i) => i.id === value);
        next[index] = { ...next[index], ingredientId: value as string, ingredientName: ing?.name || '' };
      } else {
        next[index] = { ...next[index], quantity: value as number };
      }
      return next;
    });
  };

  const removeRecipe = (index: number) => {
    setProductRecipes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.name || form.price <= 0) {
      toast.error('Nombre y precio son requeridos');
      return;
    }

    setSaving(true);

    try {
      let productId: string;

      if (editing) {
        await api.patch(`/products/${editing.id}`, form);
        productId = editing.id;
      } else {
        const res = await api.post<ApiResponse<Product>>('/products', form);
        if (!res.success || !res.data) throw new Error('Error al crear producto');
        productId = res.data.id;
      }

      // Guardar receta si hay insumos
      if (productRecipes.length > 0) {
        try {
          await api.post('/recipes/bulk', {
            productId,
            items: productRecipes.map((r) => ({
              ingredientId: r.ingredientId,
              quantity: r.quantity,
            })),
          });
        } catch {
          // Si falla la receta no bloqueamos, pero avisamos
          toast.error('Producto guardado pero hubo un error al guardar la receta');
        }
      }

      toast.success(editing ? 'Producto actualizado' : 'Producto creado');
      setShowModal(false);

      const res = await api.get<ApiResponse<Product[]>>('/products/all');
      if (res.success && res.data) setProducts(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
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
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-700">Insumos (receta)</label>
                  <button type="button" onClick={addRecipeRow} className="btn-ghost text-xs py-1 px-2">
                    <PlusCircle size={14} /> Agregar insumo
                  </button>
                </div>
                {productRecipes.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Define qué insumos consume este producto y en qué cantidad</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {productRecipes.map((recipe, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <select
                          className="input text-sm flex-1 py-1.5"
                          value={recipe.ingredientId}
                          onChange={(e) => updateRecipe(idx, 'ingredientId', e.target.value)}
                        >
                          {ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="input w-20 text-sm py-1.5 text-center"
                          value={recipe.quantity}
                          onChange={(e) => updateRecipe(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                        <button onClick={() => removeRecipe(idx)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 border-t border-surface-100 px-6 py-4">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
