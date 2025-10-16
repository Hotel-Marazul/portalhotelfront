"use client";

import CriarQuarto from "@/components/quartos/CriarQuartos";
import { Room } from "@/utils/models";

export default function QuartosPage() {
  const handleCreate = (novoQuarto: Room) => {
    console.log("Novo quarto:", novoQuarto);
    // exemplo de chamada real:
    // await apiClient.post("/quartos", novoQuarto);
  };

  return (
    <div className="p-6">
      <CriarQuarto onCreate={handleCreate} />
    </div>
  );
}
