"use client";

import { useState } from "react";
import ResumoCategorias from "@/components/categorias/ResumoCategorias";
import { Category } from "@/utils/models";

const mockCategorias: Category[] = [
  { id: 1, name: "Standard", price: 150, roomsCount: 8 },
  { id: 2, name: "Luxo", price: 250, roomsCount: 5 },
  { id: 3, name: "Suíte Master", price: 400, roomsCount: 2 },
  { id: 4, name: "Econômico", price: 100, roomsCount: 10 },
];

export default function TesteResumoCategorias() {
  const [categorias] = useState(mockCategorias);

  return (
    <div style={{ padding: 20 }}>
      <ResumoCategorias categorias={categorias} />
    </div>
  );
}
