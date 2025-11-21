import axios, { AxiosError } from "axios";

// ⚠️ Ignora SSL em localhost (apenas para desenvolvimento)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const apiClient = axios.create({
  //baseURL: "https://localhost:7207",
  baseURL: "http://localhost:5046", // ou https://localhost:7207
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Interceptor para requisições
apiClient.interceptors.request.use(
  (config) => {
    console.log("🔹 Enviando requisição para:", config.url);
    return config;
  },
  (error: AxiosError) => {
    console.error("❌ Erro na requisição:", error.message);
    return Promise.reject(error);
  }
);

// Interceptor para respostas
apiClient.interceptors.response.use(
  (response) => {
    console.log("✅ Resposta recebida:", response.config.url);
    return response;
  },
  (error: unknown) => {
    // ⚙️ Tratamento seguro de erros (corrige o TS18046)
    if (axios.isAxiosError(error)) {
      console.error("🚨 Erro Axios:", error.response?.data || error.message);
    } else if (error instanceof Error) {
      console.error("🚨 Erro genérico:", error.message);
    } else {
      console.error("🚨 Erro desconhecido:", error);
    }

    return Promise.reject(error);
  }
);

// Exemplo de função usando o client
export async function getExampleData() {
  try {
    const response = await apiClient.get("/api/exemplo");
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error("Erro na API:", error.response?.data || error.message);
    } else if (error instanceof Error) {
      console.error("Erro genérico:", error.message);
    } else {
      console.error("Erro desconhecido:", error);
    }
    throw error;
  }
}

export default apiClient;
