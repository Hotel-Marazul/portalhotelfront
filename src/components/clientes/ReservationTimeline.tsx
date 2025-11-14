import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Card,
  Stack,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Add,
} from '@mui/icons-material';
import { format, addDays, startOfWeek, isSameDay, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ModalNovaReserva from './ModalNovaReserva';

// Interfaces para tipagem
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

interface RoomGroup {
  room: Room;
  reservations: Reservation[];
}

interface ReservationPosition {
  left: string;
  width: string;
}

// ✅ Props atualizadas - aceita rooms e reservations
interface ReservationTimelineProps {
  rooms: Room[];
  reservations: Reservation[];
  onReservationCreated?: () => void;
}

const ReservationTimeline: React.FC<ReservationTimelineProps> = memo(({ rooms, reservations, onReservationCreated }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { locale: ptBR, weekStartsOn: 0 })
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [openModalReserva, setOpenModalReserva] = useState(false);

  // Número de dias visíveis (2 semanas)
  const DAYS_TO_SHOW = 14;

  // Calcula os dias visíveis
  const visibleDays = useMemo(() => {
    return Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // ✅ Combina TODOS os quartos com suas reservas
  const roomGroups = useMemo((): RoomGroup[] => {
    const groups = new Map<string, RoomGroup>();
    
    // Primeiro, cria grupos para TODOS os quartos
    rooms.forEach((room) => {
      groups.set(room.id, {
        room: room,
        reservations: [],
      });
    });
    
    // Depois, adiciona as reservas aos quartos correspondentes
    reservations.forEach((reservation) => {
      const roomId = reservation.room.id;
      if (groups.has(roomId)) {
        groups.get(roomId)!.reservations.push(reservation);
      }
    });
    
    // Converte para array e ordena por número do quarto
    return Array.from(groups.values()).sort((a, b) => a.room.number - b.room.number);
  }, [rooms, reservations]);

  // Filtra quartos por categoria
  const filteredRoomGroups = useMemo(() => {
    return roomGroups.filter(group => {
      if (categoryFilter !== 'Todos' && group.room.type !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [roomGroups, categoryFilter]);

  // Calcula posição e largura da reserva no timeline
  const calculateReservationPosition = (reservation: Reservation): ReservationPosition | null => {
    const checkIn = startOfDay(new Date(reservation.checkInDate));
    const checkOut = startOfDay(new Date(reservation.checkOutDate));
    const periodEnd = addDays(currentWeekStart, DAYS_TO_SHOW);
    
    // Verifica se a reserva está visível no período atual
    if (checkOut < currentWeekStart || checkIn >= periodEnd) {
      return null;
    }
    
    // Calcula o início e fim da reserva dentro do período visível
    const visibleStart = checkIn < currentWeekStart ? currentWeekStart : checkIn;
    const visibleEnd = checkOut > periodEnd ? periodEnd : checkOut;
    
    const startOffset = differenceInDays(visibleStart, currentWeekStart);
    const duration = differenceInDays(visibleEnd, visibleStart);
    
    return {
      left: `${(startOffset / DAYS_TO_SHOW) * 100}%`,
      width: `${(duration / DAYS_TO_SHOW) * 100}%`,
    };
  };

  // Cores para status de reserva
  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      confirmada: '#2563eb',
      pendente: '#f59e0b',
      cancelada: '#dc2626',
      'check-in': '#10b981',
      'check-out': '#8b5cf6',
    };
    return colors[status?.toLowerCase()] || '#6b7280';
  };

  const navigateWeek = useCallback((direction: number): void => {
    setCurrentWeekStart((prev) => addDays(prev, direction * DAYS_TO_SHOW));
  }, []);

  const goToToday = useCallback((): void => {
    setCurrentWeekStart(startOfWeek(new Date(), { locale: ptBR, weekStartsOn: 0 }));
  }, []);

  // Obtém categorias únicas dos quartos
  const categories = useMemo(() => {
    const cats = new Set(rooms.map(r => r.type));
    return ['Todos', ...Array.from(cats)];
  }, [rooms]);

  return (
    <Box sx={{ width: '100%', bgcolor: '#f9fafb', p: 3 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 2,
          bgcolor: 'white',
          borderRadius: 2,
          border: '1px solid #e5e7eb',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight="600" color="#111827">
              Calendário de Ocupação
            </Typography>
            <Typography variant="body2" color="#6b7280">
              Visualização de ocupação e gestão de hóspedes
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            {/* Filtros */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Categoria</InputLabel>
              <Select
                value={categoryFilter}
                label="Categoria"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="Todos">Todos</MenuItem>
                <MenuItem value="Confirmada">Confirmada</MenuItem>
                <MenuItem value="Pendente">Pendente</MenuItem>
                <MenuItem value="Disponível">Disponível</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenModalReserva(true)}
              sx={{
                bgcolor: '#2563eb',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { bgcolor: '#1d4ed8' },
              }}
            >
              Nova Reserva
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Navegação de data */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          bgcolor: 'white',
          borderRadius: 2,
          border: '1px solid #e5e7eb',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              onClick={() => navigateWeek(-1)}
              sx={{
                border: '1px solid #e5e7eb',
                '&:hover': { bgcolor: '#f3f4f6' },
              }}
            >
              <ChevronLeft />
            </IconButton>

            <Typography variant="h6" sx={{ minWidth: 280, textAlign: 'center', fontWeight: 600 }}>
              {format(currentWeekStart, "dd 'de' MMMM", { locale: ptBR })} - {format(addDays(currentWeekStart, DAYS_TO_SHOW - 1), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Typography>

            <IconButton
              onClick={() => navigateWeek(1)}
              sx={{
                border: '1px solid #e5e7eb',
                '&:hover': { bgcolor: '#f3f4f6' },
              }}
            >
              <ChevronRight />
            </IconButton>
          </Stack>

          <Button
            variant="outlined"
            onClick={goToToday}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderColor: '#e5e7eb',
              color: '#374151',
              '&:hover': { borderColor: '#d1d5db', bgcolor: '#f9fafb' },
            }}
          >
            Hoje
          </Button>
        </Stack>
      </Paper>

      {/* Grid do calendário */}
      <Paper
        elevation={0}
        sx={{
          overflow: 'hidden',
          borderRadius: 2,
          border: '1px solid #e5e7eb',
          bgcolor: 'white',
        }}
      >
        {/* Header dos dias */}
        <Box
          sx={{
            display: 'flex',
            borderBottom: '2px solid #e5e7eb',
            bgcolor: '#f9fafb',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Box
            sx={{
              width: 140,
              p: 2,
              borderRight: '2px solid #e5e7eb',
              fontWeight: 600,
              color: '#111827',
              bgcolor: '#f9fafb',
            }}
          >
            Quarto
          </Box>

          <Box sx={{ flex: 1, display: 'flex', overflowX: 'auto' }}>
            {visibleDays.map((day, index) => {
              const isToday = isSameDay(day, new Date());
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              
              return (
                <Box
                  key={index}
                  sx={{
                    minWidth: `${100 / DAYS_TO_SHOW}%`,
                    flex: 1,
                    p: 1.5,
                    textAlign: 'center',
                    borderRight: index < visibleDays.length - 1 ? '1px solid #e5e7eb' : 'none',
                    bgcolor: isWeekend ? '#f9fafb' : 'white',
                    position: 'relative',
                  }}
                >
                  {isToday && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        bgcolor: '#2563eb',
                      }}
                    />
                  )}
                  <Typography
                    variant="caption"
                    display="block"
                    color={isToday ? '#2563eb' : '#6b7280'}
                    fontWeight={isToday ? 700 : 500}
                    sx={{ fontSize: '0.7rem' }}
                  >
                    {format(day, 'EEE', { locale: ptBR }).toUpperCase()}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={isToday ? 700 : 600}
                    color={isToday ? '#2563eb' : '#111827'}
                    sx={{ fontSize: '0.95rem' }}
                  >
                    {format(day, 'dd', { locale: ptBR })}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Linhas de quartos */}
        <Box sx={{ overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
          {filteredRoomGroups.map((group) => (
            <Box
              key={group.room.id}
              sx={{
                display: 'flex',
                borderBottom: '1px solid #e5e7eb',
                minHeight: 70,
                '&:hover': { bgcolor: '#f9fafb' },
                transition: 'background-color 0.2s',
              }}
            >
              {/* Info do quarto */}
              <Box
                sx={{
                  width: 140,
                  p: 2,
                  borderRight: '2px solid #e5e7eb',
                  bgcolor: 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body1" fontWeight="700" color="#111827">
                  {group.room.number}
                </Typography>
                <Typography variant="caption" color="#6b7280" sx={{ fontSize: '0.7rem' }}>
                  {group.room.type}
                </Typography>
              </Box>

              {/* Timeline */}
              <Box
                sx={{
                  flex: 1,
                  position: 'relative',
                  display: 'flex',
                }}
              >
                {/* Grid de fundo */}
                <Box sx={{ position: 'absolute', width: '100%', height: '100%', display: 'flex' }}>
                  {visibleDays.map((day, index) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <Box
                        key={index}
                        sx={{
                          flex: 1,
                          borderRight: index < visibleDays.length - 1 ? '1px solid #f3f4f6' : 'none',
                          bgcolor: isWeekend ? '#fafafa' : isToday ? '#eff6ff' : 'transparent',
                        }}
                      />
                    );
                  })}
                </Box>

                {/* Reservas */}
                <Box sx={{ position: 'relative', width: '100%', p: 1 }}>
                  {group.reservations.map((reservation) => {
                    const position = calculateReservationPosition(reservation);
                    if (!position) return null;

                    return (
                      <Tooltip
                        key={reservation.id}
                        title={
                          <Box sx={{ p: 0.5 }}>
                            <Typography variant="body2" fontWeight="bold">
                              {reservation.client.fullName}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Check-in: {format(new Date(reservation.checkInDate), 'dd/MM/yyyy')}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Check-out: {format(new Date(reservation.checkOutDate), 'dd/MM/yyyy')}
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                              {reservation.guests?.length || 0} pessoa(s)
                            </Typography>
                          </Box>
                        }
                        arrow
                        placement="top"
                      >
                        <Card
                          sx={{
                            position: 'absolute',
                            left: position.left,
                            width: position.width,
                            minWidth: '40px',
                            top: 4,
                            bottom: 4,
                            cursor: 'pointer',
                            bgcolor: getStatusColor(reservation.status),
                            color: 'white',
                            transition: 'all 0.2s',
                            border: 'none',
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            px: 1,
                            overflow: 'hidden',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: 4,
                              zIndex: 100,
                            },
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight="600"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: '0.7rem',
                            }}
                          >
                            {reservation.client.fullName}
                          </Typography>
                        </Card>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Legenda */}
      <Paper
        elevation={0}
        sx={{
          mt: 2,
          p: 2,
          bgcolor: 'white',
          borderRadius: 2,
          border: '1px solid #e5e7eb',
        }}
      >
        <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap">
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: '#2563eb', borderRadius: 0.5 }} />
            <Typography variant="caption" color="#6b7280">Confirmada</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: '#f59e0b', borderRadius: 0.5 }} />
            <Typography variant="caption" color="#6b7280">Pendente</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: '#10b981', borderRadius: 0.5 }} />
            <Typography variant="caption" color="#6b7280">Check-in</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: '#8b5cf6', borderRadius: 0.5 }} />
            <Typography variant="caption" color="#6b7280">Check-out</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: '#e5e7eb', borderRadius: 0.5 }} />
            <Typography variant="caption" color="#6b7280">Disponível</Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Modal de Nova Reserva */}
      <ModalNovaReserva
        open={openModalReserva}
        onClose={() => setOpenModalReserva(false)}
        onSuccess={() => {
          setOpenModalReserva(false);
          // Chama callback para atualizar as reservas
          onReservationCreated?.();
        }}
        rooms={rooms}
      />
    </Box>
  );
});

ReservationTimeline.displayName = 'ReservationTimeline';

export default ReservationTimeline;
