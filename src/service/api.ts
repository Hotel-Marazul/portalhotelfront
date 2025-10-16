import axios from "axios";

// ⚠️ Ignora SSL em localhost (apenas no desenvolvimento)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const apiClient = axios.create({
  baseURL: "http://localhost:5046", // ou IP: https://192.168.X.X:7207
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Interceptor de erros
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error("Erro na API:", error?.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
