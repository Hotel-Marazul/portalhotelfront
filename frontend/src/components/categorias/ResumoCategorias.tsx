import { FiTag, FiDollarSign, FiHome, FiStar } from "react-icons/fi";
import KpiCard from "../ui/KpiCard";
import { Category } from "../../utils/models";

interface ResumoCategoriasProps {
  categorias: Category[];
}

export default function ResumoCategorias({ categorias }: ResumoCategoriasProps) {
  const total = categorias?.length ?? 0;

  const precoMedio =
    total > 0
      ? categorias.reduce((acc, c) => acc + (c.price ?? 0), 0) / total
      : 0;

  const totalQuartos = categorias?.reduce((acc, c) => acc + (c.roomsCount ?? 0), 0) ?? 0;

  const categoriaMaisPopular =
    total > 0
      ? categorias.reduce((best, cur) =>
          (cur.roomsCount ?? 0) > (best.roomsCount ?? 0) ? cur : best,
          categorias[0]
        )
      : null;

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
        label="Total de categorias"
        value={total}
        accentColor="var(--accent)"
        icon={<FiTag size={18} />}
      />
      <KpiCard
        label="Preço médio / noite"
        value={`R$ ${precoMedio.toFixed(2)}`}
        accentColor="#16a34a"
        icon={<FiDollarSign size={18} />}
      />
      <KpiCard
        label="Quartos cadastrados"
        value={totalQuartos}
        sub="em todas as categorias"
        accentColor="#0ea5e9"
        icon={<FiHome size={18} />}
      />
      <KpiCard
        label="Categoria mais popular"
        value={categoriaMaisPopular?.name ?? "—"}
        sub={categoriaMaisPopular ? `${categoriaMaisPopular.roomsCount ?? 0} quartos` : undefined}
        accentColor="#a78bfa"
        icon={<FiStar size={18} />}
      />
    </div>
  );
}
