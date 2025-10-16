"use client";

import CriarCategoria from "@/components/categorias/CriarCategorias";
import { Category } from "@/utils/models";

export default function QuartosPage() {
  const handleCreate = (novaCategoria: Category) => {
    console.log("Novo quarto:", novaCategoria);
    // exemplo de chamada real:
    // await apiClient.post("/quartos", novaCategoria);
  };

  return (
    <div className="p-6">
      <CriarCategoria onCreate={handleCreate} />
    </div>
  );
}
