"use client";
import { Suspense, lazy } from 'react';
import { Box, CircularProgress, Alert, Button, Stack } from '@mui/material';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import type { ReservationsResponse } from '../../types/reservations';

// Lazy loading dos componentes pesados
const ReservationTimeline = lazy(() => import("../../components/clientes/ReservationTimeline"));
const Clientes = lazy(() => import("../../components/clientes/createUserTable"));

interface Guest {
  id: string;
  name: string;
  age: number;
  pricingRuleId: string;
}

interface Room {
  id: string;
  number: number;
  categoryId: string;
  type: string;
  capacity: number;
  status: string;
  price: number;
}

interface Client {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  fone: string;
  automovel: string;
  placa: string;
}

interface Reservation {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  room: Room;
  client: Client;
  guests: Guest[];
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
  } = useCachedFetch<ReservationsResponse>('/api/Reservations?limit=100', {
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
  const reservations: Reservation[] = (reservationsData?.items as Reservation[]) || [];

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
      {/* Timeline de Reservas com TODOS os quartos */}
      <Box>
        <Suspense fallback={
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={40} />
          </Box>
        }>
          <ReservationTimeline 
            rooms={rooms} 
            reservations={reservations}
            onReservationCreated={handleReservationCreated}
          />
        </Suspense>
      </Box>
      
      {/* Tabela de Clientes */}
      <Box>
        <Suspense fallback={
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={40} />
          </Box>
        }>
          <Clientes />
        </Suspense>
      </Box>
    </Stack>
  );
}
