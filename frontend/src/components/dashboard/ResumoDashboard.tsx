import { Box, Card, CardContent, Grid, Typography } from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import BedIcon from "@mui/icons-material/Bed";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";

interface ResumoDashboardProps {
  resumoQuartos: {
    ocupados: number;
    disponiveis: number;
    manutencao: number;
  } | null;
  receitaMesAtual: number;
  receitaMesAnterior: number;
  reservasAtivas: number;
}

export default function ResumoDashboard({
  resumoQuartos,
  receitaMesAtual,
  receitaMesAnterior,
  reservasAtivas
}: ResumoDashboardProps) {
  const quartosOcupados = resumoQuartos?.ocupados ?? 0;
  const quartosDisponiveis = resumoQuartos?.disponiveis ?? 0;
  const manutencao = resumoQuartos?.manutencao ?? 0;
  const totalQuartos = quartosOcupados + quartosDisponiveis + manutencao;

  const diferenca =
    receitaMesAnterior > 0
      ? ((receitaMesAtual - receitaMesAnterior) / receitaMesAnterior) * 100
      : 0;

  const aumento = diferenca >= 0;
  const diferencaFormatada = `${aumento ? "+" : ""}${diferenca.toFixed(1)}%`;

  return (
    <Grid container spacing={2} sx={{ my: 2 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-200 rounded-2xl">
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                Quartos Ocupados (Periodo)
              </Typography>
              <BedIcon color="primary" />
            </Box>
            <Typography variant="h5" color="primary" fontWeight={700}>
              {quartosOcupados}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              de {totalQuartos} quartos totais
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-200 rounded-2xl">
          <CardContent sx={{ p: 2, pr: 1.5 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                Quartos Disponiveis (Periodo)
              </Typography>
              <BedIcon sx={{ color: "green" }} />
            </Box>
            <Typography variant="h5" sx={{ color: "green", fontWeight: 700 }}>
              {quartosDisponiveis}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              prontos para novas reservas
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-200 rounded-2xl">
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                Reservas Ativas
              </Typography>
              <EventAvailableIcon sx={{ color: "orange" }} />
            </Box>
            <Typography variant="h5" sx={{ color: "orange", fontWeight: 700 }}>
              {reservasAtivas}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              incluindo check-ins hoje
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-200 rounded-2xl">
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                Receita do Mes
              </Typography>
              <AttachMoneyIcon sx={{ color: "green" }} />
            </Box>
            <Typography variant="h5" sx={{ color: "green", fontWeight: 700 }}>
              R${" "}
              {receitaMesAtual.toLocaleString("pt-BR", {
                minimumFractionDigits: 2
              })}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: aumento ? "green" : "red",
                fontWeight: 500
              }}
            >
              {aumento ? "↑" : "↓"} {diferencaFormatada} vs mes anterior
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
