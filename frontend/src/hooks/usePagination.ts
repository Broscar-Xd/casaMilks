import { useMemo, useState } from 'react';

/**
 * Hook de paginación local (cliente) para listas.
 * Devuelve la porción visible de items y los metadatos para <Pagination />.
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return {
    page: safePage,
    totalPages,
    total: items.length,
    pageSize,
    paginatedItems,
    setPage,
  };
}
