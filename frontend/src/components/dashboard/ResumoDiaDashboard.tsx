// ResumoDiaDashboard.tsx
import { Grid, Card, CardContent, Typography, Box } from "@mui/material";

interface ResumoDiaProps {
  checkIns: number;
  checkOuts: number;
  receita: number;
}

export default function ResumoDiaDashboard({ checkIns, checkOuts, receita }: ResumoDiaProps) {
  const receitaFormatada = receita.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2
  });

  const cards = [
    { titulo: "Check-ins Hoje", valor: checkIns, cor: "#e0f2ff", textoCor: "#1e40af" },
    { titulo: "Check-outs Hoje", valor: checkOuts, cor: "#fff4e5", textoCor: "#d9480f" },
    { titulo: "Receita Hoje", valor: receitaFormatada, cor: "#ecfdf5", textoCor: "#15803d" },
  ];

  return (
    <Box
      sx={{
        m: 4, // margem externa
        p: 4, // padding interno
        borderRadius: 2,
        backgroundColor: "#ffffff",
        border: "1px solid #ddd", // contorno
      }}
    >
      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        Resumo do Dia
      </Typography>

      <Grid container spacing={2}>
        {cards.map((card) => (
          <Grid key={card.titulo} size={{ xs: 12, sm: 4 }}> {/* Cada card ocupa 1/3 do container a partir do sm */}
            <Card
              elevation={0}
              sx={{
                backgroundColor: card.cor,
                borderRadius: 2,
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="subtitle2" sx={{ color: card.textoCor, mb: 1 }}>
                  {card.titulo}
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: card.textoCor }}>
                  {card.valor}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
