import { Card, CardContent, Grid, Typography } from "@mui/material";

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
    <Grid container spacing={2} sx={{ my: 2 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-300 rounded-lg">
          <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="h5" color="error">
              {summary.ocupados}
            </Typography>
            <Typography className="text-slate-500">Ocupados no periodo</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-300 rounded-lg">
          <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="h5" color="success.main">
              {summary.disponiveis}
            </Typography>
            <Typography className="text-slate-500">Disponiveis no periodo</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-300 rounded-lg">
          <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="h5" color="warning.main">
              {summary.manutencao}
            </Typography>
            <Typography className="text-slate-500">Em manutencao</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-300 rounded-lg">
          <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="h5" color="primary">
              {totalQuartos}
            </Typography>
            <Typography className="text-slate-500">
              Total ({totalOperacional} operacionais)
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
