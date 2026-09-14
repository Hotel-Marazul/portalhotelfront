import { useState, useEffect, useCallback, useRef } from 'react';
import { requestCache } from '../utils/cache';
import apiClient from '../services/api';
import { AxiosError } from 'axios';

interface UseCachedFetchOptions {
  cacheKey: string;
  expiresIn?: number; // em milissegundos, padrão 5 minutos
  enabled?: boolean; // se false, não faz a requisição
  allowCache?: boolean; // somente para dados explicitamente escopados à sessão
}

export function useCachedFetch<T>(
  url: string,
  options: UseCachedFetchOptions
) {
  const { cacheKey, expiresIn, enabled = true, allowCache = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async (forceRefresh = false) => {
    const requestId = ++requestIdRef.current;
    if (!enabled) {
      if (requestId === requestIdRef.current) setLoading(false);
      return;
    }

    // Dados protegidos não usam cache por padrão: a primeira leitura sempre valida a sessão.
    if (allowCache && !forceRefresh) {
      const cached = requestCache.get<T>(cacheKey);
      if (cached) {
        if (requestId !== requestIdRef.current) return;
        setData(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get<T>(url);
      const responseData = response.data;
      if (requestId !== requestIdRef.current) return;
      if (allowCache) requestCache.set(cacheKey, responseData, expiresIn);
      setData(responseData);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const message = err.response?.data?.message || err.message;
        setError(`Erro ${status || ''}: ${message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      }
      setData(null);
      console.error('Erro ao buscar dados:', err);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [url, cacheKey, expiresIn, enabled, allowCache]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const clearCache = useCallback(() => {
    requestCache.clear(cacheKey);
  }, [cacheKey]);

  return { data, loading, error, refetch, clearCache };
}

