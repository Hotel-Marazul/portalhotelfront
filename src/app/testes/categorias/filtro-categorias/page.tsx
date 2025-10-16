"use client";

import { useState } from "react";
import FiltroCategorias from "@/components/categorias/FiltroCategorias";

export default function TesteFiltroQuartos() {
  const [busca, setBusca] = useState("");

  return (
    <div className="p-4 space-y-4">
      <FiltroCategorias
        busca={busca}
        setBusca={setBusca}
      />

      <div>
        <strong>Busca digitada:</strong> {busca || "Nenhuma"}
      </div>
    </div>
  );
}
