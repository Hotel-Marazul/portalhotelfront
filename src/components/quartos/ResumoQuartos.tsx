import { Grid, Card, CardContent, Typography } from "@mui/material";
import { Room } from "@/utils/models"; // sua interface já existente

interface ResumoQuartosProps {
  quartos: Room[];
}

function contarStatus(quartos: Room[]) {
  const statusCounts: Record<string, number> = {
    "Livre": 0,
    "Ocupado": 0,
    "Manutenção": 0,
  };

  quartos.forEach((q) => {
    if (statusCounts[q.status] !== undefined) {
      statusCounts[q.status]++;
    }
  });

  return statusCounts;
}

export default function ResumoQuartos({ quartos }: ResumoQuartosProps) {
  const status = contarStatus(quartos);

  return (
      <Grid container spacing={2} sx={{ my: 2 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} className="border border-gray-300 rounded-lg">
            <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
            {/* <CardContent sx={{ pb: '16px !important' }}> */}
              <Typography variant="h5" color="green">{status.Livre}</Typography>
              <Typography className="text-slate-500">Quartos Livres</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} className="border border-gray-300 rounded-lg">
            <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="h5" color="red">{status.Ocupado}</Typography>
              <Typography className="text-slate-500">Quartos Ocupados</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} className="border border-gray-300 rounded-lg">
            <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="h5" color="orange">{status["Manutenção"]}</Typography>
              <Typography className="text-slate-500">Em Manutenção</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} className="border border-gray-300 rounded-lg">
            <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="h5" color="primary">{quartos.length}</Typography>
              <Typography className="text-slate-500">Total de Quartos</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  }