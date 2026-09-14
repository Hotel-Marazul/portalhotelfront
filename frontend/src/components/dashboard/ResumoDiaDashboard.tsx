"use client";
import { useEffect, useState } from "react";
import { formatReservationDisplayDate } from "../../utils/reservation";
interface ResumoDiaProps { checkIns: number; checkOuts: number; receita?: number; pendencias?: number; }
export default function ResumoDiaDashboard({ checkIns, checkOuts, receita, pendencias = 0 }: ResumoDiaProps) {
  const [today, setToday] = useState("");
  useEffect(() => { setToday(formatReservationDisplayDate(new Date(), { weekday: "long", day: "numeric", month: "long" })); }, []);
  const metrics = [
    { label: "Chegadas hoje", value: checkIns },
    { label: "Saídas hoje", value: checkOuts },
    ...(receita === undefined ? [] : [{ label: "Receita hoje", value: receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }]),
    { label: "Pendências vencidas", value: pendencias },
  ];
  return <dl className="daily-summary">
    <div><dt>Hoje</dt><dd style={{ fontSize: 16 }}>{today || "Carregando data…"}</dd></div>
    {metrics.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </dl>;
}
