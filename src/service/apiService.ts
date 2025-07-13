import apiClient from "@/service/api";

// GET genérico
export const apiGet = async (endpoint: string, params = {}) => {
  const response = await apiClient.get(endpoint, { params });
  return response.data;
};

// POST genérico
export const apiPost = async (endpoint: string, data: unknown) => {
  const response = await apiClient.post(endpoint, data);
  return response.data;
};
