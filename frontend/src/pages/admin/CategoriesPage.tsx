import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Loader2, Layers, X, GripVertical } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import { usePagination } from '@/hooks/usePagination';
import type { Category, ApiResponse, ComboLine, ComboProduct } from '@/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '', isCombo: false, sortOrder: 0 });

  // Combo configuration
  const [comboLines, setComboLines] = useState<ComboLine[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [comboSaving, setComboSaving] = useState(false);

  // Products by category for combo selection
  const [categoryProducts, setCategoryProducts] = useState<Record<string, ComboProduct[]>>({});
  // Which category the user is browsing per line (filter, not a constraint)
  const [browsingCategory, setBrowsingCategory] = useState<Record<string, string>>({});

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

  const fetchAllCategories = async () => {
    try {
      const res = await api.get<ApiResponse<Category[]>>('/categories/all');
      if (res.success && res.data) setAllCategories(res.data);
    } catch { /* silent */ }
  };

  const fetchComboLines = async (categoryId: string) => {
    try {
      const res = await api.get<ApiResponse<ComboLine[]>>(`/categories/${categoryId}/combos`);
      if (res.success && res.data) {
        const lines = res.data.map(line => ({
          ...line,
          productIds: (line.comboLineProducts || []).map(clp => clp.productId),
          sourceCategoryId: line.sourceCategoryId ?? undefined,
        }));
        setComboLines(lines);
        // Fetch products for all categories (except the combo category itself)
        const otherCats = allCategories.filter(c => c.id !== editing?.id);
        for (const cat of otherCats) {
          if (!categoryProducts[cat.id]) {
            fetchCategoryProducts(cat.id);
          }
        }
      }
    } catch {
      setComboLines([]);
    }
  };

  const fetchCategoryProducts = async (categoryId: string) => {
    if (categoryProducts[categoryId]) return;
    try {
      const res = await api.get<{ success: boolean; data: ComboProduct[] }>(`/products/by-category/${categoryId}`);
      if (res.success && res.data) {
        setCategoryProducts(prev => ({ ...prev, [categoryId]: res.data }));
      }
    } catch { /* silent */ }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', isCombo: false, sortOrder: categories.length });
    setComboLines([]);
    setShowModal(true);
  };

  const openEdit = async (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '', isCombo: cat.isCombo || false, sortOrder: cat.sortOrder ?? 0 });
    setComboLines([]);
    if (cat.isCombo) {
      await fetchComboLines(cat.id);
    }
    await fetchAllCategories();
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

  const handleSaveCombos = async () => {
    if (!editing) return;
    setComboSaving(true);
    try {
      await api.put(`/categories/${editing.id}/combos`, { lines: comboLines.map(l => ({
        label: l.label,
        sourceCategoryId: l.sourceCategoryId || null,
        productIds: l.productIds || [],
        minSelect: l.minSelect,
        maxSelect: l.maxSelect,
        required: l.required,
        sortOrder: l.sortOrder,
      }))});
      toast.success('Líneas de combo guardadas');
      fetchComboLines(editing.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar combo');
    } finally {
      setComboSaving(false);
    }
  };

  const addComboLine = () => {
    setComboLines(prev => [...prev, {
      id: `new-${Date.now()}`,
      categoryId: editing?.id || '',
      label: '',
      sourceCategoryId: undefined,
      productIds: [],
      minSelect: 1,
      maxSelect: 1,
      required: true,
      sortOrder: prev.length,
    }]);
  };

  const updateComboLine = (index: number, field: string, value: any) => {
    const lineId = comboLines[index]?.id;
    setComboLines(prev => prev.map((line, i) =>
      i === index ? { ...line, [field]: value } : line
    ));
    // If sourceCategoryId changed, fetch products and update browsing category
    if (field === 'sourceCategoryId' && value && lineId) {
      fetchCategoryProducts(value);
      setBrowsingCategory(prev => ({ ...prev, [lineId]: value }));
    }
  };

  const removeComboLine = (index: number) => {
    setComboLines(prev => prev.filter((_, i) => i !== index));
  };

  const { page, totalPages, total, pageSize, paginatedItems, setPage } = usePagination(categories, 10);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-cocoa-500" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
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
              <th className="table-header w-14 text-center">Sec.</th>
              <th className="table-header">Nombre</th>
              <th className="table-header">Descripción</th>
              <th className="table-header text-center">Tipo</th>
              <th className="table-header text-center">Activo</th>
              <th className="table-header text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {paginatedItems.map((cat) => (
              <tr key={cat.id} className="table-row">
                <td className="table-cell text-center font-mono text-xs text-cocoa-500">{cat.sortOrder ?? 0}</td>
                <td className="table-cell font-medium text-surface-900">{cat.name}</td>
                <td className="table-cell text-surface-400">{cat.description || '—'}</td>
                <td className="table-cell text-center">
                  {cat.isCombo ? (
                    <span className="badge bg-cocoa-50 text-cocoa-700 ring-1 ring-cocoa-200/60 flex items-center gap-1 justify-center">
                      <Layers size={12} /> Combo
                    </span>
                  ) : (
                    <span className="text-xs text-surface-300">Simple</span>
                  )}
                </td>
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
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-lg modal-content mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
            <div className="border-b border-surface-100 px-6 py-4 shrink-0">
              <h2 className="text-lg font-semibold">{editing ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
            </div>
            <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Secuencial (orden en el POS)</label>
                <input type="number" min={0} className="input" value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
                <p className="mt-1 text-[10px] text-cocoa-400">Las categorías se muestran de menor a mayor en el POS.</p>
              </div>

              {/* Toggle isCombo */}
              <div className="flex items-center justify-between rounded-xl bg-cocoa-50/50 border border-cocoa-200/60 p-4">
                <div>
                  <p className="text-sm font-medium text-cocoa-900">Categoría combinada (Combo)</p>
                  <p className="text-xs text-cocoa-400 mt-0.5">Los productos de esta categoría requerirán seleccionar opciones</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, isCombo: !form.isCombo });
                    if (!form.isCombo && editing) {
                      fetchComboLines(editing.id);
                      fetchAllCategories();
                    }
                    if (!form.isCombo && !editing) {
                      fetchAllCategories();
                    }
                  }}
                  className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
                    form.isCombo ? 'bg-cocoa-600' : 'bg-surface-200'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    form.isCombo ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>

              {/* Combo Configuration */}
              {form.isCombo && (
                <div className="space-y-3 border border-milk-200/90 rounded-2xl bg-milk-50/80 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-cocoa-900">Líneas del Combo</p>
                    <button type="button" onClick={addComboLine} className="btn-ghost text-xs py-1 px-2.5">
                      <Plus size={14} /> Agregar línea
                    </button>
                  </div>

                  {comboLines.length === 0 && (
                    <p className="text-xs text-cocoa-300 text-center py-4">
                      Este combo no tiene líneas. Agrega al menos una línea (ej: "Elige tu bebida caliente")
                    </p>
                  )}

                  {comboLines.map((line, idx) => (
                    <div key={line.id} className="rounded-xl border border-milk-200/80 bg-white p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-cocoa-200 shrink-0" />
                        <input
                          className="input flex-1 text-sm py-1.5"
                          placeholder="Ej: Elige tu bebida caliente"
                          value={line.label}
                          onChange={e => updateComboLine(idx, 'label', e.target.value)}
                        />
                        <button type="button" onClick={() => removeComboLine(idx)} className="text-red-400 hover:text-red-600 p-1">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {/* Category filter — only changes which products are visible */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-cocoa-400 mb-0.5 block">Filtrar por categoría</label>
                            <select
                              className="input text-sm py-1.5"
                              value={browsingCategory[line.id] || ''}
                              onChange={e => {
                                setBrowsingCategory(prev => ({ ...prev, [line.id]: e.target.value }));
                                if (e.target.value && !categoryProducts[e.target.value]) {
                                  fetchCategoryProducts(e.target.value);
                                }
                              }}
                            >
                              <option value="">Todas las categorías</option>
                              {allCategories
                                .filter(c => c.id !== editing?.id)
                                .map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                          </div>
                        </div>

                        {/* Selected products counter */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-cocoa-500 font-medium">
                            {(line.productIds || []).length} producto{(line.productIds || []).length !== 1 ? 's' : ''} seleccionado{(line.productIds || []).length !== 1 ? 's' : ''}
                          </span>
                          {(line.productIds || []).length > 0 && (
                            <button
                              type="button"
                              onClick={() => updateComboLine(idx, 'productIds', [])}
                              className="text-[10px] text-red-400 hover:text-red-600 underline"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>

                        {/* Selected product chips */}
                        {(line.productIds || []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Object.values(categoryProducts).flat().filter(p => (line.productIds || []).includes(p.id)).map(prod => (
                              <span key={prod.id} className="inline-flex items-center gap-1 rounded-full bg-cocoa-100 text-cocoa-700 px-2 py-0.5 text-[10px] font-medium">
                                {prod.name}
                                <button type="button" onClick={() => {
                                  const next = (line.productIds || []).filter(id => id !== prod.id);
                                  updateComboLine(idx, 'productIds', next);
                                }} className="hover:text-red-500">✕</button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Product picker — only shows when a category filter is selected */}
                        <div className="border border-milk-200/70 rounded-xl bg-milk-50/50 p-2.5">
                          {(() => {
                            const filterCatId = browsingCategory[line.id];
                            if (!filterCatId) {
                              return (
                                <div className="text-center py-3">
                                  <p className="text-xs text-cocoa-400 mb-1">Selecciona una categoría arriba para ver sus productos</p>
                                  <p className="text-[10px] text-cocoa-300">Los productos que ya seleccionaste se muestran arriba como chips</p>
                                </div>
                              );
                            }

                            const productsToShow = categoryProducts[filterCatId];
                            if (!productsToShow) {
                              return <div className="flex items-center justify-center gap-2 text-xs text-cocoa-300 py-3">
                                <Loader2 size={12} className="animate-spin" /> Cargando productos...
                              </div>;
                            }
                            if (productsToShow.length === 0) {
                              return <p className="text-xs text-cocoa-300 text-center py-3">No hay productos en esta categoría</p>;
                            }

                            return (
                              <div className="flex flex-wrap gap-1.5">
                                {productsToShow.map(prod => {
                                  const selected = (line.productIds || []).includes(prod.id);
                                  return (
                                    <button
                                      key={prod.id}
                                      type="button"
                                      onClick={() => {
                                        const current = line.productIds || [];
                                        const next = selected
                                          ? current.filter(id => id !== prod.id)
                                          : [...current, prod.id];
                                        updateComboLine(idx, 'productIds', next);
                                      }}
                                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                                        selected
                                          ? 'bg-cocoa-600 text-milk-50 shadow-sm ring-1 ring-cocoa-400'
                                          : 'bg-white text-cocoa-600 border border-cocoa-200 hover:border-cocoa-400'
                                      }`}
                                    >
                                      {selected && <span className="text-milk-300">✓</span>}
                                      {prod.name}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-cocoa-400 mb-0.5 block">Min</label>
                            <input type="number" className="input text-sm py-1.5" min={0} value={line.minSelect}
                              onChange={e => updateComboLine(idx, 'minSelect', parseInt(e.target.value) || 0)} />
                          </div>
                          <div>
                            <label className="text-xs text-cocoa-400 mb-0.5 block">Max</label>
                            <input type="number" className="input text-sm py-1.5" min={1} value={line.maxSelect}
                              onChange={e => updateComboLine(idx, 'maxSelect', parseInt(e.target.value) || 1)} />
                          </div>
                          <div className="flex items-end pb-1.5">
                            <label className="flex items-center gap-1.5 text-xs text-cocoa-500 cursor-pointer">
                              <input type="checkbox" checked={line.required}
                                onChange={e => updateComboLine(idx, 'required', e.target.checked)}
                                className="rounded border-cocoa-300 text-cocoa-600 focus:ring-cocoa-500" />
                              Requerido
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleSaveCombos}
                    disabled={comboSaving || comboLines.length === 0}
                    className="btn-primary w-full text-sm py-2 mt-1"
                  >
                    {comboSaving ? 'Guardando...' : 'Guardar configuración de combo'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-3 border-t border-surface-100 px-6 py-4 shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSubmit} className="btn-primary flex-1">{editing ? 'Actualizar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
