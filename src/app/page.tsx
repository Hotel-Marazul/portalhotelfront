// page.tsx - Dashboard de Reservas de Hotel com Material UI
"use client"

import { Typography } from '@mui/material';
import { redirect } from 'next/navigation';

export default function Home() { 
  redirect('/dashboard');
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