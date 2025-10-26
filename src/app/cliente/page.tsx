"use client";
import { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert, Button, Stack } from '@mui/material';
import ReservationTimeline from "@/components/clientes/ReservationTimeline";
import Clientes from "@/components/clientes/createUserTable";
import apiClient from '@/service/api';
import { AxiosError } from 'axios';

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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Busca quartos E reservas simultaneamente
      const [roomsResponse, reservationsResponse] = await Promise.all([
        apiClient.get<Room[]>('/api/rooms'),
        apiClient.get<Reservation[]>('/api/reservations')
      ]);
      
      setRooms(roomsResponse.data);
      setReservations(reservationsResponse.data);
      
    } catch (err) {
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const message = err.response?.data?.message || err.message;
        setError(`Erro ${status || ''}: ${message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Erro desconhecido ao buscar dados');
      }
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        <ReservationTimeline 
          rooms={rooms} 
          reservations={reservations}
        />
      </Box>
      
      {/* Tabela de Clientes */}
      <Box>
        <Clientes />
      </Box>
    </Stack>
  );
}
