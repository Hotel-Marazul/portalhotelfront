"use client";
import { Suspense, lazy } from 'react';
import { Box, CircularProgress, Alert, Button, Stack } from '@mui/material';
import Link from 'next/link';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import type { ReservationDto, ReservationsResponse } from '../../types/reservations';
import PageHeader from '../../components/layout/PageHeader';
import PageSection from '../../components/layout/PageSection';

// Lazy loading dos componentes pesados
const ReservationTimeline = lazy(() => import("../../components/clientes/ReservationTimeline"));
const Clientes = lazy(() => import("../../components/clientes/createUserTable"));

// Backend enforces Math.min(100, ...) as the maximum page size.
// The timeline only shows the first MAX_RESERVATIONS_LIMIT reservations;
// hotels with more than 100 active reservations will not see older ones here.
const MAX_RESERVATIONS_LIMIT = 100;

// Room shape as returned by /api/rooms (used for the timeline grid)
interface Room {
  id: string;
  number: number;
  categoryId: string;
  type: string;
  capacity: number;
  status: string;
  price: number;
}

export default function ClienteTable() {
  // Usa cache para evitar requisições duplicadas
  const { 
    data: roomsData, 
    loading: loadingRooms, 
    error: errorRooms,
    refetch: refetchRooms 
  } = useCachedFetch<Room[]>('/api/rooms', { 
    cacheKey: 'rooms',
    expiresIn: 5 * 60 * 1000 // 5 minutos
  });

  const {
    data: reservationsData,
    loading: loadingReservations,
    error: errorReservations,
    refetch: refetchReservations
  } = useCachedFetch<ReservationsResponse>(`/api/Reservations?limit=${MAX_RESERVATIONS_LIMIT}`, {
    cacheKey: 'reservations',
    expiresIn: 5 * 60 * 1000 // 5 minutos
  });

  const loading = loadingRooms || loadingReservations;
  const error = errorRooms || errorReservations;

  const fetchData = () => {
    refetchRooms();
    refetchReservations();
  };

  // Callback para atualizar reservas após criar uma nova
  const handleReservationCreated = () => {
    refetchReservations();
  };

  // Garante que sempre temos arrays, mesmo que vazios
  const rooms: Room[] = roomsData || [];
  const reservations: ReservationDto[] = reservationsData?.items ?? [];

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={60} />
        <p>Carregando dados...</p>
      </Box>
    );
  }

  if (error) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        p={3}
      >
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={fetchData}>
              Recarregar
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      <Box className="px-4 sm:px-6 pt-2">
        <PageHeader
          title="Hóspedes"
          description="Consulte hóspedes, veja o histórico de reservas e crie novas reservas com rapidez."
          actions={
            <>
              <Link href="/dashboard" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] no-underline transition-colors hover:bg-slate-50">
                Dashboard
              </Link>
              <Button variant="contained" onClick={fetchData}>
                Recarregar
              </Button>
            </>
          }
        />
      </Box>

      <Box className="px-4 sm:px-6">
        <PageSection
          title="Mapa de reservas"
          description="Timeline dos quartos com disponibilidade e ocupação para os próximos dias."
          actions={<Button variant="outlined" onClick={fetchData}>Atualizar dados</Button>}
        >
          <Suspense fallback={
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={40} />
            </Box>
          }>
            <ReservationTimeline
              rooms={rooms}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              reservations={reservations as any}
              onReservationCreated={handleReservationCreated}
            />
          </Suspense>
        </PageSection>
      </Box>

      <Box className="px-4 sm:px-6 pb-8">
        <PageSection
          title="Lista de hóspedes"
          description="Cadastro, busca rápida e ações de visualização/edição em uma visão única."
        >
          <Suspense fallback={
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={40} />
            </Box>
          }>
            <Clientes />
          </Suspense>
        </PageSection>
      </Box>
    </Stack>
  );
}
