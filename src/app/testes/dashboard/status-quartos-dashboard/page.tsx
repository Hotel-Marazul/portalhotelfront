"use client";

import { useState } from "react";
import StatusQuartosDashboard from "@/components/dashboard/StatusQuartosDashboard"; // ajuste o caminho conforme sua estrutura

export default function TesteStatusQuartosDashboard() {
  const [dados] = useState({
    ocupados: 28,
    disponiveis: 12,
    total: 40,
  });

  return (
<div
  style={{
    padding: "24px",
    display: "flex",
    justifyContent: "flex-start", // ou "stretch"
    alignItems: "flex-start",     // ou "stretch"
    backgroundColor: "#f9fafb",
    minHeight: "100vh",
    width: "50%",
  }}
>
      <StatusQuartosDashboard
        ocupados={dados.ocupados}
        disponiveis={dados.disponiveis}
        total={dados.total}
      />
    </div>
  );
}
