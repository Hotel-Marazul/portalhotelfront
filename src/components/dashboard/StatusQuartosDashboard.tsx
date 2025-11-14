import { Card, CardContent, Typography, LinearProgress, Box, Divider } from "@mui/material";

interface StatusQuartosProps {
  ocupados: number;
  disponiveis: number;
  total: number;
}

export default function StatusQuartosDashboard({ ocupados, disponiveis, total }: StatusQuartosProps) {
  const taxaOcupacao = ((ocupados / total) * 100).toFixed(0);
  const taxaDisponiveis = ((disponiveis / total) * 100).toFixed(0);

  return (
    <Card
      elevation={0}
      className="border border-gray-200 rounded-xl shadow-sm bg-white"
        sx={{
        p: 2,
        width: "100%",
        height: "100%",        // 🔥 preenche igual ao gráfico
        display: "flex",
        flexDirection: "column",
    }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Título */}
        <Typography variant="h6" fontWeight={600}>
          Status dos Quartos
        </Typography>
        <Typography variant="body2" className="text-gray-500 mb-4">
          Situação atual
        </Typography>

        {/* Ocupados */}
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
            value={Number(taxaOcupacao)}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "#e5e7eb",
              "& .MuiLinearProgress-bar": { backgroundColor: "#1e40af" }, 
            }}
          />
        </Box>

        {/* Disponíveis */}
        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              Disponíveis
            </Typography>
            <Typography variant="body2" sx={{ color: "#16a34a" }}>
              {disponiveis} ({taxaDisponiveis}%)
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Number(taxaDisponiveis)}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "#e5e7eb",
              "& .MuiLinearProgress-bar": { backgroundColor: "#16a34a" }, // verde
            }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Taxa de ocupação */}
        <Box textAlign="center">
          <Typography variant="h5" fontWeight={700}>
            {taxaOcupacao}%
          </Typography>
          <Typography variant="body2" className="text-gray-500">
            Taxa de ocupação atual (dos quartos aptos a receber hóspedes)
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
