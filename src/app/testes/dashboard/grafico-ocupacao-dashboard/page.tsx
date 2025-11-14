"use client";

import { useState } from "react";
import GraficoOcupacaoDashboard from "@/components/dashboard/GraficoOcupacaoDashboard";

export default function TesteGrafico() {
  const [dados] = useState([
    { mes: "Jan", taxa: 65 },
    { mes: "Fev", taxa: 72 },
    { mes: "Mar", taxa: 80 },
    { mes: "Abr", taxa: 85 },
    { mes: "Mai", taxa: 82 },
    { mes: "Jun", taxa: 90 },
    { mes: "Jul", taxa: 97 },
    { mes: "Ago", taxa: 90 },
    { mes: "Set", taxa: 70 },
  ]);

  return (
    <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto" }}>
      <GraficoOcupacaoDashboard dados={dados} />
    </div>
  );
}
