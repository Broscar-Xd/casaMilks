import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useBranch } from '@/contexts/BranchContext';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Pencil, Loader2, Search, ChefHat, Trash2, PlusCircle, Layers } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import { usePagination } from '@/hooks/usePagination';
import type { Product, Category, Ingredient, ModifierGroup, ApiResponse } from '@/types';

/** Grupo de opciones en el formulario de admin (forma simplificada para editar). */
interface AdminModGroup {
  name: string;
  required: boolean;   // ¿obligatorio elegir?
  multiple: boolean;   // ¿permite elegir varias opciones?
  options: Array<{ name: string; priceDelta: number }>;
}

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
  const [modGroups, setModGroups] = useState<AdminModGroup[]>([]);

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
    setModGroups([]);
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

    // Cargar grupos de opciones existentes
    try {
      const res = await api.get<ApiResponse<ModifierGroup[]>>(`/modifiers/product/${product.id}`);
      if (res.success && res.data) {
        setModGroups(
          res.data.map((g) => ({
            name: g.name,
            required: g.required,
            multiple: g.maxSelect > 1,
            options: g.options.map((o) => ({ name: o.name, priceDelta: Number(o.priceDelta) })),
          }))
        );
      } else {
        setModGroups([]);
      }
    } catch {
      setModGroups([]);
    }

    setShowModal(true);
  };

  // --- Handlers de grupos de opciones ---
  const addModGroup = () => {
    setModGroups((prev) => [...prev, { name: '', required: false, multiple: false, options: [{ name: '', priceDelta: 0 }] }]);
  };
  const patchModGroup = (gi: number, patch: Partial<AdminModGroup>) => {
    setModGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  };
  const removeModGroup = (gi: number) => {
    setModGroups((prev) => prev.filter((_, i) => i !== gi));
  };
  const addModOption = (gi: number) => {
    setModGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, options: [...g.options, { name: '', priceDelta: 0 }] } : g)));
  };
  const patchModOption = (gi: number, oi: number, patch: Partial<{ name: string; priceDelta: number }>) => {
    setModGroups((prev) =>
      prev.map((g, i) =>
        i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : g
      )
    );
  };
  const removeModOption = (gi: number, oi: number) => {
    setModGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g)));
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

      // Guardar grupos de opciones (se envía siempre: reemplaza los existentes,
      // así también sirve para borrarlos todos dejando la lista vacía).
      try {
        const validGroups = modGroups
          .map((g) => ({
            name: g.name.trim(),
            required: g.required,
            minSelect: g.required ? 1 : 0,
            maxSelect: g.multiple ? 99 : 1,
            options: g.options
              .filter((o) => o.name.trim())
              .map((o) => ({ name: o.name.trim(), priceDelta: Number(o.priceDelta) || 0 })),
          }))
          .filter((g) => g.name && g.options.length > 0);
        await api.post('/modifiers/bulk', { productId, groups: validGroups });
      } catch {
        toast.error('Producto guardado pero hubo un error al guardar las opciones');
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

  const { page, totalPages, total, pageSize, paginatedItems, setPage } = usePagination(filtered, 12);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-cocoa-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
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
              {paginatedItems.map((product) => (
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
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-lg modal-content mx-2 sm:mx-0 flex flex-col max-h-[90vh]">
            <div className="border-b border-surface-100 px-6 py-4 shrink-0">
              <h2 className="text-lg font-semibold">{editing ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            </div>
            <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
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
                      className="text-cocoa-500 focus:ring-cocoa-500" />
                    <span className="text-sm text-gray-700">Sí</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="requiresPreparation" checked={form.requiresPreparation === false}
                      onChange={() => setForm({ ...form, requiresPreparation: false })}
                      className="text-cocoa-500 focus:ring-cocoa-500" />
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

              {/* Grupos de opciones / modificadores */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Layers size={15} /> Opciones / Acompañamientos
                  </label>
                  <button type="button" onClick={addModGroup} className="btn-ghost text-xs py-1 px-2">
                    <PlusCircle size={14} /> Agregar grupo
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Ej: “Elige tu bebida” (jugo frío / caliente) o “Agregar acompañamiento” (huevo, pan). Precio 0 = incluido.
                </p>

                {modGroups.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Este producto no tiene opciones. Agrega un grupo si quieres ofrecer complementos.</p>
                ) : (
                  <div className="space-y-3">
                    {modGroups.map((group, gi) => (
                      <div key={gi} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            className="input text-sm flex-1 py-1.5"
                            placeholder="Nombre del grupo (ej: Elige tu bebida)"
                            value={group.name}
                            onChange={(e) => patchModGroup(gi, { name: e.target.value })}
                          />
                          <button type="button" onClick={() => removeModGroup(gi)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={group.required} onChange={(e) => patchModGroup(gi, { required: e.target.checked })} />
                            Obligatorio elegir
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={group.multiple} onChange={(e) => patchModGroup(gi, { multiple: e.target.checked })} />
                            Permite elegir varias
                          </label>
                        </div>
                        <div className="space-y-1.5 pl-1">
                          {group.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                className="input text-sm flex-1 py-1"
                                placeholder="Opción (ej: Jugo frío)"
                                value={opt.name}
                                onChange={(e) => patchModOption(gi, oi, { name: e.target.value })}
                              />
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">+$</span>
                                <input
                                  type="number" step="0.01" min="0"
                                  className="input w-20 text-sm py-1 text-center"
                                  value={opt.priceDelta}
                                  onChange={(e) => patchModOption(gi, oi, { priceDelta: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <button type="button" onClick={() => removeModOption(gi, oi)} className="text-red-400 hover:text-red-600 p-1">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addModOption(gi)} className="btn-ghost text-xs py-1 px-2">
                            <PlusCircle size={13} /> Agregar opción
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 border-t border-surface-100 px-6 py-4 shrink-0">
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
