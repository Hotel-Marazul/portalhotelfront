import { Grid, Card, CardContent, Typography } from "@mui/material";
import { Category } from "@/utils/models"; 

interface ResumoCategoriasProps {
  categorias: Category[];
}

export default function ResumoCategorias({ categorias }: ResumoCategoriasProps) {
  const totalCategorias = categorias?.length ?? 0;
  const precoMedio =
    totalCategorias > 0
      ? categorias.reduce((acc, c) => acc + (c.price ?? 0), 0) / totalCategorias
      : 0;

  const totalQuartos =
    categorias?.reduce((acc, c) => acc + (c.roomsCount ?? 0), 0) ?? 0;

  const categoriaMaisPopular =
    totalCategorias > 0
      ? categorias.reduce((maisPopular, atual) => {
          if (!maisPopular || (atual.roomsCount ?? 0) > (maisPopular.roomsCount ?? 0)) {
            return atual;
          }
          return maisPopular;
        }, categorias[0])
      : null;

  return (
    <Grid container spacing={2} sx={{ my: 2 }}>
      {/* Total de Categorias */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-300 rounded-lg">
          <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="h5" color="primary">
              {totalCategorias}
            </Typography>
            <Typography className="text-slate-500">Total de Categorias</Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Preço Médio */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-300 rounded-lg">
          <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="h5" color="green">
              R${precoMedio.toFixed(2)}
            </Typography>
            <Typography className="text-slate-500">Preço Médio</Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Total de Quartos Cadastrados */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-300 rounded-lg">
          <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="h5" color="orange">
              {totalQuartos}
            </Typography>
            <Typography className="text-slate-500">Quartos Cadastrados</Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Categoria Mais Popular */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card elevation={0} className="border border-gray-300 rounded-lg">
          <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="h6" color="secondary">
              {categoriaMaisPopular?.name ?? "N/A"}
            </Typography>
            <Typography className="text-slate-500">Categoria Mais Popular</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
