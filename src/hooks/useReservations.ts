import { useState, useEffect, useCallback, useMemo } from "react";
import { getReservations, updateReservationStatus } from "@/services/reservations";
import { ReservationsFilters, ReservationDto, ReservationStatus } from "@/types/reservations";
import { requestCache } from "@/utils/cache";

interface UseReservationsOptions {
  initialFilters?: ReservationsFilters;
  autoFetch?: boolean;
}

export function useReservations(options: UseReservationsOptions = {}) {
  const { initialFilters = {}, autoFetch = true } = options;
  
  const [filters, setFilters] = useState<ReservationsFilters>({
    page: 1,
    pageSize: 10,
    sortBy: "checkInDate",
    sortDir: "desc",
    ...initialFilters,
  });
  
  const [data, setData] = useState<ReservationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); // Inicia como true para mostrar loading na primeira renderização
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = useCallback(async (filtersToUse: ReservationsFilters) => {
    const cacheKey = `reservations-${JSON.stringify(filtersToUse)}`;
    
    // Verifica cache
    const cached = requestCache.get<{ items: ReservationDto[]; total: number }>(cacheKey);
    if (cached) {
      setData(cached.items);
      setTotal(cached.total);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await getReservations();
      
      // Salva no cache
      requestCache.set(cacheKey, { items: response.items, total: response.total }, 2 * 60 * 1000); // 2 minutos
      
      setData(response.items);
      setTotal(response.total);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao buscar reservas";
      setError(errorMessage);
      console.error("Erro ao buscar reservas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Busca automaticamente quando os filtros mudam
  useEffect(() => {
    if (autoFetch) {
      fetchReservations(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, JSON.stringify(filters)]);

  const updateFilters = useCallback((newFilters: Partial<ReservationsFilters>) => {
    setFilters((prev) => {
      const updated = { ...prev, ...newFilters };
      // Reset page quando outros filtros mudam
      if (newFilters.search !== undefined || newFilters.cpf !== undefined || 
          newFilters.status !== undefined || newFilters.roomId !== undefined) {
        updated.page = 1;
      }
      return updated;
    });
  }, []);

  const changePage = useCallback((page: number) => {
    updateFilters({ page });
  }, [updateFilters]);

  const changePageSize = useCallback((pageSize: number) => {
    updateFilters({ pageSize, page: 1 });
  }, [updateFilters]);

  const changeSort = useCallback((sortBy: string, sortDir: "asc" | "desc") => {
    updateFilters({ sortBy, sortDir });
  }, [updateFilters]);

  const handleStatusChange = useCallback(async (
    reservationId: string,
    newStatus: ReservationStatus
  ) => {
    try {
      await updateReservationStatus(reservationId, { status: newStatus });
      // Atualiza localmente
      setData((prev) =>
        prev.map((reservation) =>
          reservation.id === reservationId
            ? { ...reservation, status: newStatus }
            : reservation
        )
      );
      // Limpa cache para forçar refresh
      requestCache.clear();
      return true;
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      throw err;
    }
  }, []);

  const refetch = useCallback(() => {
    fetchReservations(filters);
  }, [fetchReservations, filters]);

  const clearFilters = useCallback(() => {
    setFilters({
      page: 1,
      pageSize: 10,
      sortBy: "checkInDate",
      sortDir: "desc",
    });
  }, []);

  const currentPage = filters.page || 1;
  const totalPages = Math.ceil(total / (filters.pageSize || 10));

  return {
    data,
    total,
    loading,
    error,
    filters,
    currentPage,
    totalPages,
    updateFilters,
    changePage,
    changePageSize,
    changeSort,
    handleStatusChange,
    refetch,
    clearFilters,
  };
}

