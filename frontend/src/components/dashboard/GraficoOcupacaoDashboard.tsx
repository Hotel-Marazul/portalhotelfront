"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

interface GraficoOcupacaoProps {
  dados: { mes: string; taxa: number }[];
}

export default function GraficoOcupacaoDashboard({ dados }: GraficoOcupacaoProps) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "22px 24px 16px",
        height: "100%",
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
        Taxa de Ocupação
      </span>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-display)",
          fontSize: "1.2rem",
          color: "var(--text-primary)",
          marginBottom: "20px",
        }}
      >
        Últimos 9 meses
      </span>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={dados} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="occupancyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "DM Sans, sans-serif" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "DM Sans, sans-serif" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload?.length) {
                return (
                  <div
                    style={{
                      background: "var(--sidebar-bg)",
                      border: "1px solid var(--sidebar-border)",
                      borderRadius: "8px",
                      padding: "8px 14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--sidebar-text)",
                        marginBottom: "2px",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.5rem",
                        color: "var(--accent)",
                        fontWeight: 600,
                        lineHeight: 1,
                      }}
                    >
                      {payload[0].value}%
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="taxa"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#occupancyGrad)"
            dot={false}
            activeDot={{ r: 5, fill: "#f59e0b", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
