import { useState, useMemo } from "react";

const DEFAULT_PAGE_SIZE = 25;

interface UsePaginationResult<T> {
  page: number;
  pageSize: number;
  totalPages: number;
  pageItems: T[];
  setPage: (page: number) => void;
}

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE): UsePaginationResult<T> {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return { page: safePage, pageSize, totalPages, pageItems, setPage };
}
