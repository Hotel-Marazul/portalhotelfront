import { LuBed } from "react-icons/lu";
import { FiCalendar, FiBriefcase, FiDollarSign, FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import KpiCard from "../ui/KpiCard";

interface ResumoDashboardProps {
  resumoQuartos: {
    ocupados: number;
    disponiveis: number;
    manutencao: number;
  } | null;
  receitaMesAtual: number;
  receitaMesAnterior: number;
  recebidaMesAtual?: number;
  showFinancial?: boolean;
  reservasAtivas: number;
}

export default function ResumoDashboard({
  resumoQuartos,
  receitaMesAtual,
  receitaMesAnterior,
  recebidaMesAtual = 0,
  showFinancial = true,
  reservasAtivas,
}: ResumoDashboardProps) {
  const ocupados = resumoQuartos?.ocupados ?? 0;
  const disponiveis = resumoQuartos?.disponiveis ?? 0;
  const manutencao = resumoQuartos?.manutencao ?? 0;
  const total = ocupados + disponiveis + manutencao;

  const diff =
    receitaMesAnterior > 0
      ? ((receitaMesAtual - receitaMesAnterior) / receitaMesAnterior) * 100
      : 0;
  const isUp = diff >= 0;
  const diffStr = `${isUp ? "+" : ""}${diff.toFixed(1)}%`;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "14px" }}>
      <KpiCard
        label="Quartos Ocupados"
        value={ocupados}
        sub={
          <>
            de {total} totais
            {manutencao > 0 && (
              <span style={{ marginLeft: "6px", color: "#b45309" }}>
                · {manutencao} em manutenção
              </span>
            )}
          </>
        }
        accentColor="var(--accent)"
        icon={<LuBed size={22} />}
      />
      <KpiCard
        label="Disponíveis"
        value={disponiveis}
        sub="prontos para novas reservas"
        accentColor="#16a34a"
        icon={<LuBed size={22} />}
      />
      <KpiCard
        label="Reservas Ativas"
        value={reservasAtivas}
        sub="incluindo check-ins hoje"
        accentColor="#0ea5e9"
        icon={<FiCalendar size={20} />}
      />
      {showFinancial && <>
        <KpiCard
          label="Receita reservada"
          value={`R$ ${receitaMesAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub={
            <span
              style={{
                color: isUp ? "#16a34a" : "#dc2626",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              {isUp ? (
                <FiTrendingUp size={12} style={{ flexShrink: 0 }} />
              ) : (
                <FiTrendingDown size={12} style={{ flexShrink: 0 }} />
              )}
              {diffStr} vs mês anterior
            </span>
          }
          accentColor={isUp ? "#16a34a" : "#dc2626"}
          icon={<FiBriefcase size={20} />}
        />
        <KpiCard
          label="Recebido no mês"
          value={`R$ ${recebidaMesAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub="pagamentos e estornos registrados"
          accentColor="#7c3aed"
          icon={<FiDollarSign size={20} />}
        />
      </>}
    </div>
  );
}
