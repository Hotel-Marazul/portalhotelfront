// page.tsx - Dashboard de Reservas de Hotel com Material UI
"use client"

import { Typography } from '@mui/material';

export default function Home() {
  return (
    <div className="p-8">
      <Typography variant="h4" component="h1" sx={{ mb: 4 }}>
        Bem-vindo ao Portal Hotel
      </Typography>
      <Typography variant="body1">
        Utilize o menu lateral para navegar entre as funcionalidades do sistema.
      </Typography>

    </div>
  );
}