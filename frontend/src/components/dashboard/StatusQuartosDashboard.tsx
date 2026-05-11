import { Card, CardContent, Typography, LinearProgress, Box, Divider } from "@mui/material";

interface StatusQuartosProps {
  ocupados: number;
  disponiveis: number;
  total: number;
}

function toPercent(value: number, base: number): number {
  if (base <= 0) return 0;
  const percent = (value / base) * 100;
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export default function StatusQuartosDashboard({ ocupados, disponiveis, total }: StatusQuartosProps) {
  const baseTotal = total > 0 ? total : ocupados + disponiveis;
  const taxaOcupacao = toPercent(ocupados, baseTotal);
  const taxaDisponiveis = toPercent(disponiveis, baseTotal);

  return (
    <Card
      elevation={0}
      className="border border-gray-200 rounded-xl shadow-sm bg-white"
      sx={{
        p: 2,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          Status dos Quartos
        </Typography>
        <Typography variant="body2" className="text-gray-500 mb-4">
          Situacao no periodo selecionado
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              Ocupados
            </Typography>
            <Typography variant="body2" color="primary">
              {ocupados} ({taxaOcupacao}%)
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={taxaOcupacao}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "#e5e7eb",
              "& .MuiLinearProgress-bar": { backgroundColor: "#1e40af" }
            }}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              Disponiveis
            </Typography>
            <Typography variant="body2" sx={{ color: "#16a34a" }}>
              {disponiveis} ({taxaDisponiveis}%)
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={taxaDisponiveis}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "#e5e7eb",
              "& .MuiLinearProgress-bar": { backgroundColor: "#16a34a" }
            }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box textAlign="center">
          <Typography variant="h5" fontWeight={700}>
            {taxaOcupacao}%
          </Typography>
          <Typography variant="body2" className="text-gray-500">
            Taxa de ocupacao no periodo (quartos aptos a receber hospedes)
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
