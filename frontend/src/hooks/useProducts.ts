import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { Product, Category, ApiResponse } from '@/types';

interface UseProductsResult {
  products: Product[];
  categories: Category[];
  loading: boolean;
  selectedCategory: string | null;
  setSelectedCategory: (id: string | null) => void;
}

export function useProducts(branchId: string | undefined): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [prodRes, catRes] = await Promise.all([
          api.get<ApiResponse<Product[]>>(`/products?branchId=${branchId}${selectedCategory ? `&categoryId=${selectedCategory}` : ''}`),
          api.get<ApiResponse<Category[]>>('/categories'),
        ]);

        if (prodRes.success && prodRes.data) setProducts(prodRes.data);
        if (catRes.success && catRes.data) setCategories(catRes.data);
      } catch {
        // Error silencioso
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId, selectedCategory]);

  return { products, categories, loading, selectedCategory, setSelectedCategory };
}
