interface StatusQuartosProps {
  ocupados: number;
  disponiveis: number;
  total: number;
}

function pct(value: number, base: number): number {
  if (base <= 0) return 0;
  return Math.min(100, Math.round((value / base) * 100));
}

export default function StatusQuartosDashboard({ ocupados, disponiveis, total }: StatusQuartosProps) {
  const base = total > 0 ? total : ocupados + disponiveis;
  const taxaOcupacao = pct(ocupados, base);
  const taxaDisponiveis = pct(disponiveis, base);

  const bars = [
    { label: "Ocupados", value: ocupados, pct: taxaOcupacao, color: "var(--accent)" },
    { label: "Disponíveis", value: disponiveis, pct: taxaDisponiveis, color: "#16a34a" },
  ];

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "22px 24px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "0.62rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "4px",
        }}
      >
        Status dos Quartos
      </span>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-display)",
          fontSize: "1.2rem",
          color: "var(--text-primary)",
          marginBottom: "24px",
        }}
      >
        Período selecionado
      </span>

      {/* Hero number */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "4.5rem",
            fontWeight: 600,
            lineHeight: 1,
            color: "var(--text-primary)",
          }}
        >
          {taxaOcupacao}
          <span style={{ fontSize: "2rem", color: "var(--text-muted)", fontWeight: 300 }}>%</span>
        </div>
        <div
          style={{
            fontSize: "0.62rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginTop: "6px",
          }}
        >
          Taxa de Ocupação
        </div>
      </div>

      {/* Progress bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "auto" }}>
        {bars.map((row) => (
          <div key={row.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "7px",
              }}
            >
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {row.label}
              </span>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                {row.value}{" "}
                <span style={{ color: row.color, fontWeight: 600 }}>({row.pct}%)</span>
              </span>
            </div>
            <div
              style={{
                height: "6px",
                borderRadius: "3px",
                background: "var(--border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: "3px",
                  background: row.color,
                  width: `${row.pct}%`,
                  transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
