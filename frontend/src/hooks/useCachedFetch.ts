import { useState, useEffect, useCallback } from 'react';
import { requestCache } from '../utils/cache';
import apiClient from '../services/api';
import { AxiosError } from 'axios';

interface UseCachedFetchOptions {
  cacheKey: string;
  expiresIn?: number; // em milissegundos, padrão 5 minutos
  enabled?: boolean; // se false, não faz a requisição
}

export function useCachedFetch<T>(
  url: string,
  options: UseCachedFetchOptions
) {
  const { cacheKey, expiresIn, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Verifica cache primeiro (a menos que forceRefresh seja true)
    if (!forceRefresh) {
      const cached = requestCache.get<T>(cacheKey);
      if (cached) {
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
      
      // Salva no cache
      requestCache.set(cacheKey, responseData, expiresIn);
      
      setData(responseData);
    } catch (err) {
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const message = err.response?.data?.message || err.message;
        setError(`Erro ${status || ''}: ${message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      }
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [url, cacheKey, expiresIn, enabled]);

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

