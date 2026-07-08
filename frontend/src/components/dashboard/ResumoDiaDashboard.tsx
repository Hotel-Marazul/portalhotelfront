interface ResumoDiaProps {
  checkIns: number;
  checkOuts: number;
  receita: number;
}

export default function ResumoDiaDashboard({ checkIns, checkOuts, receita }: ResumoDiaProps) {
  const receitaFormatada = receita.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const metrics = [
    { label: "Check-ins", value: checkIns, color: "#34d399" },
    { label: "Check-outs", value: checkOuts, color: "var(--accent)" },
    { label: "Receita Hoje", value: receitaFormatada, color: "#a78bfa" },
  ];

  return (
    <div
      style={{
        background: "var(--sidebar-bg)",
        borderRadius: "14px",
        padding: "20px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "24px",
      }}
    >
      {/* Date label */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            color: "var(--accent)",
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: "5px",
          }}
        >
          Hoje
        </div>
        <div
          style={{
            color: "#f1f5f9",
            fontFamily: "var(--font-display)",
            fontSize: "1.05rem",
            fontWeight: 400,
            textTransform: "capitalize",
          }}
        >
          {today}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: "1px",
          height: "40px",
          background: "var(--sidebar-border)",
          flexShrink: 0,
        }}
      />

      {/* Metrics */}
      <div style={{ display: "flex", flex: 1, justifyContent: "flex-end" }}>
        {metrics.map((item, i) => (
          <div
            key={item.label}
            style={{
              padding: "0 28px",
              textAlign: "center",
              borderLeft: i > 0 ? "1px solid var(--sidebar-border)" : "none",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2rem",
                fontWeight: 600,
                lineHeight: 1,
                color: item.color,
                marginBottom: "4px",
              }}
            >
              {item.value}
            </div>
            <div
              style={{
                color: "var(--sidebar-text)",
                fontSize: "0.7rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
