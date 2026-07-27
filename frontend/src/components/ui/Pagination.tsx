import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: Array<number | '...'> = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-milk-200/70 bg-milk-50/50">
      <p className="text-xs text-cocoa-400">
        Mostrando <span className="font-semibold text-cocoa-700">{from}–{to}</span> de{' '}
        <span className="font-semibold text-cocoa-700">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-milk-200 bg-white text-cocoa-500 transition-all hover:bg-milk-100 hover:border-cocoa-300 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Página anterior"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-xs text-cocoa-300">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`h-8 min-w-8 px-2 rounded-lg text-xs font-medium transition-all ${
                p === page
                  ? 'bg-gradient-to-r from-cocoa-600 to-cocoa-700 text-milk-50 shadow-md shadow-cocoa-600/25'
                  : 'border border-milk-200 bg-white text-cocoa-500 hover:bg-milk-100 hover:border-cocoa-300'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-milk-200 bg-white text-cocoa-500 transition-all hover:bg-milk-100 hover:border-cocoa-300 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Página siguiente"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
