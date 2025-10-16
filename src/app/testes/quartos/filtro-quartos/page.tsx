"use client";

import { useState } from "react";
import FiltroQuartos from "@/components/quartos/FiltroQuartos";

export default function TesteFiltroQuartos() {
  const [status, setStatus] = useState("");
  const [busca, setBusca] = useState("");

  return (
    <div className="p-4 space-y-4">
      <FiltroQuartos
        status={status}
        setStatus={setStatus}
        busca={busca}
        setBusca={setBusca}
      />

      <div>
        <strong>Status selecionado:</strong> {status || "Todos"}
      </div>
      <div>
        <strong>Busca digitada:</strong> {busca || "Nenhuma"}
      </div>
    </div>
  );
}
