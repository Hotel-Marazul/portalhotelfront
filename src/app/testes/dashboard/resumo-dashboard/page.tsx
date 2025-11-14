"use client";

import { useState } from "react";
import ResumoDashboard from "@/components/dashboard/ResumoDashboard";
import { Room, Reservation } from "@/utils/models";

const mockQuartos: Room[] = [
  {
    id: "1",
    number: 101,
    type: "Simples",
    status: "Livre",
    capacity: 2,
    price: 100,
    categoryId: "A",
  },
  {
    id: "2",
    number: 102,
    type: "Duplo",
    status: "Ocupado",
    capacity: 3,
    price: 150,
    categoryId: "B",
  },
  {
    id: "3",
    number: 103,
    type: "Simples",
    status: "Ocupado",
    capacity: 2,
    price: 120,
    categoryId: "A",
  },
  {
    id: "4",
    number: 104,
    type: "Suíte",
    status: "Livre",
    capacity: 4,
    price: 200,
    categoryId: "C",
  },
];

const mockReservas: Reservation[] = [
  {
    id: "r1",
    status: "Ativa",
    checkInDate: new Date().toISOString(), // reserva atual
    checkOutDate: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(),
    totalPrice: 450,
    room: mockQuartos[1],
    client: {
      id: "c1",
      fullName: "João Silva",
      cpf: "123.456.789-00",
      email: "joao@exemplo.com",
      automovel: "Fusca",
      placa: "ABC-1234",
      fone: "99999-9999",
    },
    guests: [
      { id: "g1", name: "Maria", age: 30, pricingRuleId: "padrao" },
    ],
  },
  {
    id: "r2",
    status: "Finalizada",
    checkInDate: new Date(
      new Date().setMonth(new Date().getMonth() - 1)
    ).toISOString(), // mês anterior
    checkOutDate: new Date(
      new Date().setMonth(new Date().getMonth() - 1)
    ).toISOString(),
    totalPrice: 600,
    room: mockQuartos[2],
    client: {
      id: "c2",
      fullName: "Carlos Pereira",
      cpf: "987.654.321-00",
      email: "carlos@exemplo.com",
      automovel: "Celta",
      placa: "XYZ-9876",
      fone: "98888-8888",
    },
    guests: [
      { id: "g2", name: "Ana", age: 25, pricingRuleId: "promo" },
    ],
  },
];

export default function TesteResumoDashboard() {
  const [quartos] = useState(mockQuartos);
  const [reservas] = useState(mockReservas);

  return (
    <div style={{ padding: 20 }}>
      <ResumoDashboard quartos={quartos} reservas={reservas} />
    </div>
  );
}
