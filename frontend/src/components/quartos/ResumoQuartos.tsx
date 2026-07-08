import { LuBed } from "react-icons/lu";
import { FiTool } from "react-icons/fi";
import KpiCard from "../ui/KpiCard";

interface OccupancySummary {
  ocupados: number;
  disponiveis: number;
  manutencao: number;
}

interface ResumoQuartosProps {
  summary: OccupancySummary;
}

export default function ResumoQuartos({ summary }: ResumoQuartosProps) {
  const totalOperacional = summary.ocupados + summary.disponiveis;
  const totalQuartos = totalOperacional + summary.manutencao;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "14px",
        margin: "16px 0",
      }}
    >
      <KpiCard
        label="Ocupados no período"
        value={summary.ocupados}
        sub={`de ${totalQuartos} totais`}
        accentColor="#dc2626"
        icon={<LuBed size={20} />}
      />
      <KpiCard
        label="Disponíveis no período"
        value={summary.disponiveis}
        sub="prontos para reservas"
        accentColor="#16a34a"
        icon={<LuBed size={20} />}
      />
      <KpiCard
        label="Em manutenção"
        value={summary.manutencao}
        sub="fora de operação"
        accentColor="#d97706"
        icon={<FiTool size={18} />}
      />
      <KpiCard
        label="Total de quartos"
        value={totalQuartos}
        sub={`${totalOperacional} operacionais`}
        accentColor="var(--accent)"
        icon={<LuBed size={20} />}
      />
    </div>
  );
}
