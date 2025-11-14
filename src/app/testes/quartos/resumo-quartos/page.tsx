"use client";

import { useState } from "react";
import ResumoQuartos from "@/components/quartos/ResumoQuartos";
import { Room } from "@/utils/models";

const mockQuartos: Room[] = [
  { id: 1, number: 101, type: "Simples", status: "Livre", capacity: 2, price: 100 },
  { id: 2, number: 102, type: "Duplo", status: "Ocupado", capacity: 3, price: 150 },
  { id: 3, number: 103, type: "Simples", status: "Manutenção", capacity: 1, price: 80 },
  { id: 4, number: 104, type: "Duplo", status: "Livre", capacity: 2, price: 120 },
];

export default function TesteResumoQuartos() {
  const [quartos] = useState(mockQuartos);

  return (
    <div style={{ padding: 20 }}>
      <ResumoQuartos quartos={quartos} />
    </div>
  );
}
