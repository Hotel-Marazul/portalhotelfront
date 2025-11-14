"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, Typography } from "@mui/material";

interface GraficoOcupacaoProps {
  dados: { mes: string; taxa: number }[];
}

export default function GraficoOcupacaoDashboard({ dados }: GraficoOcupacaoProps) {
  return (
    <Card
      elevation={0}
      className="border border-gray-200 rounded-2xl"
      sx={{ mt: 0 }}
    >
      <CardContent sx={{ p: 2, margin: 0 }}>
        <Typography variant="subtitle1" sx={{ ml: 2 }} fontWeight={600}>
          Taxa de Ocupação (%)
        </Typography>

        <Typography className="text-sm text-slate-500" variant="subtitle1" sx={{ ml: 2 }} mb={2}>
          Últimos 9 meses
        </Typography>

        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis domain={[0, 100]} />
              
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const { value } = payload[0];
                    return (
                      <div
                        style={{
                          background: "white",
                          border: "1px solid #ccc",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: "bold" }}>Mês: {label}</p>
                        <p
                          style={{
                            margin: 0,
                            color: "#1e40af",
                            fontWeight: 500,
                          }}
                        >
                          Taxa de Ocupação: {value}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Line
                type="monotone"
                dataKey="taxa"
                stroke="#1e40af"
                strokeWidth={2}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
