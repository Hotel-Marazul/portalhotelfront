import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import { Add, ChevronLeft, ChevronRight } from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { addDays, differenceInDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import apiClient from "../../services/api";
import ModalNovaReserva from "./ModalNovaReserva";

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

interface ReservationTimelineProps {
  rooms: Room[];
  reservations: Reservation[];
  onReservationCreated?: () => void;
}

const DAYS_TO_SHOW = 14;

function statusColor(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === "confirmada") return "#2563eb";
  if (normalized === "pendente") return "#f59e0b";
  if (normalized === "cancelada") return "#dc2626";
  if (normalized === "emandamento") return "#10b981";
  if (normalized === "concluida" || normalized === "concluída") return "#8b5cf6";
  return "#6b7280";
}

function overlapsVisiblePeriod(
  checkInDate: string,
  checkOutDate: string,
  periodStart: Date,
  periodEnd: Date
): ReservationPosition | null {
  const checkIn = startOfDay(new Date(checkInDate));
  const checkOut = startOfDay(new Date(checkOutDate));

  if (checkOut < periodStart || checkIn >= periodEnd) {
    return null;
  }

  const visibleStart = checkIn < periodStart ? periodStart : checkIn;
  const visibleEnd = checkOut > periodEnd ? periodEnd : checkOut;

  const startOffset = differenceInDays(visibleStart, periodStart);
  const duration = Math.max(1, differenceInDays(visibleEnd, visibleStart));

  return {
    left: `${(startOffset / DAYS_TO_SHOW) * 100}%`,
    width: `${(duration / DAYS_TO_SHOW) * 100}%`
  };
}

const ReservationTimeline: React.FC<ReservationTimelineProps> = memo(
  ({ rooms, reservations, onReservationCreated }) => {
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
      startOfWeek(new Date(), { locale: ptBR, weekStartsOn: 0 })
    );
    const [categoryFilter, setCategoryFilter] = useState<string>("Todos");
    const [statusFilter, setStatusFilter] = useState<string>("Todos");
    const [openModalReserva, setOpenModalReserva] = useState(false);

    const [availabilityCheckInDate, setAvailabilityCheckInDate] = useState<Date | null>(new Date());
    const [availabilityCheckOutDate, setAvailabilityCheckOutDate] = useState<Date | null>(
      addDays(new Date(), 1)
    );
    const [availableRoomsForDate, setAvailableRoomsForDate] = useState<Room[]>([]);
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [availabilityError, setAvailabilityError] = useState<string | null>(null);

    const visibleDays = useMemo(
      () => Array.from({ length: DAYS_TO_SHOW }, (_, index) => addDays(currentWeekStart, index)),
      [currentWeekStart]
    );

    const roomGroups = useMemo<RoomGroup[]>(() => {
      const groups = new Map<string, RoomGroup>();

      rooms.forEach((room) => {
        groups.set(room.id, { room, reservations: [] });
      });

      reservations.forEach((reservation) => {
        const roomId = reservation.room?.id;
        if (!roomId) return;

        const group = groups.get(roomId);
        if (!group) return;

        if (statusFilter !== "Todos" && reservation.status !== statusFilter) {
          return;
        }

        group.reservations.push(reservation);
      });

      return Array.from(groups.values()).sort((a, b) => a.room.number - b.room.number);
    }, [rooms, reservations, statusFilter]);

    const filteredRoomGroups = useMemo(() => {
      return roomGroups.filter((group) => {
        if (categoryFilter !== "Todos" && group.room.type !== categoryFilter) {
          return false;
        }
        return true;
      });
    }, [roomGroups, categoryFilter]);

    const categories = useMemo(() => {
      const unique = new Set(rooms.map((room) => room.type));
      return ["Todos", ...Array.from(unique)];
    }, [rooms]);

    const navigateWeek = useCallback((direction: number) => {
      setCurrentWeekStart((previous) => addDays(previous, direction * DAYS_TO_SHOW));
    }, []);

    const goToToday = useCallback(() => {
      setCurrentWeekStart(startOfWeek(new Date(), { locale: ptBR, weekStartsOn: 0 }));
    }, []);

    useEffect(() => {
      if (!availabilityCheckInDate || !availabilityCheckOutDate) return;

      const checkIn = startOfDay(availabilityCheckInDate);
      const checkOut = startOfDay(availabilityCheckOutDate);
      if (checkOut <= checkIn) {
        setAvailabilityCheckOutDate(addDays(checkIn, 1));
      }
    }, [availabilityCheckInDate, availabilityCheckOutDate]);

    useEffect(() => {
      if (!availabilityCheckInDate || !availabilityCheckOutDate) {
        setAvailableRoomsForDate([]);
        setAvailabilityError(null);
        return;
      }

      let cancelled = false;
      const checkIn = startOfDay(availabilityCheckInDate);
      const checkOut = startOfDay(availabilityCheckOutDate);

      if (checkOut <= checkIn) {
        setAvailableRoomsForDate([]);
        setAvailabilityError("Check-out deve ser posterior ao check-in.");
        return;
      }

      setLoadingAvailability(true);
      setAvailabilityError(null);

      apiClient
        .get<Room[]>("/api/rooms/availability", {
          params: {
            checkIn: checkIn.toISOString(),
            checkOut: checkOut.toISOString()
          }
        })
        .then((response) => {
          if (cancelled) return;
          setAvailableRoomsForDate(Array.isArray(response.data) ? response.data : []);
        })
        .catch(() => {
          if (cancelled) return;
          setAvailableRoomsForDate([]);
          setAvailabilityError("Nao foi possivel consultar disponibilidade.");
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingAvailability(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [availabilityCheckInDate, availabilityCheckOutDate]);

    const periodEnd = addDays(currentWeekStart, DAYS_TO_SHOW);

    return (
      <Box sx={{ width: "100%", bgcolor: "#f9fafb", p: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 2,
            bgcolor: "white",
            borderRadius: 2,
            border: "1px solid #e5e7eb"
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={2}
          >
            <Box>
              <Typography variant="h5" fontWeight={600} color="#111827">
                Calendario de Ocupacao
              </Typography>
              <Typography variant="body2" color="#6b7280">
                Visualizacao da ocupacao e gestao de reservas
              </Typography>
            </Box>

            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Categoria</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Categoria"
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <MenuItem value="Todos">Todos</MenuItem>
                  <MenuItem value="Confirmada">Confirmada</MenuItem>
                  <MenuItem value="Pendente">Pendente</MenuItem>
                  <MenuItem value="EmAndamento">Em andamento</MenuItem>
                  <MenuItem value="Concluída">Concluida</MenuItem>
                  <MenuItem value="Cancelada">Cancelada</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setOpenModalReserva(true)}
                sx={{
                  bgcolor: "#2563eb",
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "#1d4ed8" }
                }}
              >
                Nova Reserva
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 2,
            bgcolor: "white",
            borderRadius: 2,
            border: "1px solid #e5e7eb"
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
            <Box sx={{ width: { xs: "100%", md: 600 } }}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <DatePicker
                    label="Check-in"
                    value={availabilityCheckInDate}
                    onChange={(date) => setAvailabilityCheckInDate(date)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small"
                      }
                    }}
                  />
                  <DatePicker
                    label="Check-out"
                    value={availabilityCheckOutDate}
                    onChange={(date) => setAvailabilityCheckOutDate(date)}
                    minDate={
                      availabilityCheckInDate
                        ? addDays(startOfDay(availabilityCheckInDate), 1)
                        : undefined
                    }
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small"
                      }
                    }}
                  />
                </Stack>
              </LocalizationProvider>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="#4b5563" sx={{ mb: 1 }}>
                {loadingAvailability
                  ? "Consultando quartos disponiveis..."
                  : `Quartos disponiveis: ${availableRoomsForDate.length}`}
              </Typography>

              {availabilityError ? (
                <Typography variant="caption" color="error">
                  {availabilityError}
                </Typography>
              ) : (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {availableRoomsForDate.length > 0 ? (
                    availableRoomsForDate.map((room) => (
                      <Chip
                        key={room.id}
                        size="small"
                        label={`Quarto ${room.number} - ${room.type}`}
                        sx={{ mb: 1 }}
                      />
                    ))
                  ) : (
                    !loadingAvailability && (
                      <Typography variant="caption" color="#6b7280">
                        Nenhum quarto livre para o periodo selecionado.
                      </Typography>
                    )
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            bgcolor: "white",
            borderRadius: 2,
            border: "1px solid #e5e7eb"
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                onClick={() => navigateWeek(-1)}
                sx={{
                  border: "1px solid #e5e7eb",
                  "&:hover": { bgcolor: "#f3f4f6" }
                }}
              >
                <ChevronLeft />
              </IconButton>

              <Typography variant="h6" sx={{ minWidth: 280, textAlign: "center", fontWeight: 600 }}>
                {format(currentWeekStart, "dd 'de' MMMM", { locale: ptBR })} -{" "}
                {format(addDays(currentWeekStart, DAYS_TO_SHOW - 1), "dd 'de' MMMM 'de' yyyy", {
                  locale: ptBR
                })}
              </Typography>

              <IconButton
                onClick={() => navigateWeek(1)}
                sx={{
                  border: "1px solid #e5e7eb",
                  "&:hover": { bgcolor: "#f3f4f6" }
                }}
              >
                <ChevronRight />
              </IconButton>
            </Stack>

            <Button
              variant="outlined"
              onClick={goToToday}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                borderColor: "#e5e7eb",
                color: "#374151",
                "&:hover": { borderColor: "#d1d5db", bgcolor: "#f9fafb" }
              }}
            >
              Hoje
            </Button>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            overflow: "hidden",
            borderRadius: 2,
            border: "1px solid #e5e7eb",
            bgcolor: "white"
          }}
        >
          <Box
            sx={{
              display: "flex",
              borderBottom: "2px solid #e5e7eb",
              bgcolor: "#f9fafb",
              position: "sticky",
              top: 0,
              zIndex: 10
            }}
          >
            <Box
              sx={{
                width: 140,
                p: 2,
                borderRight: "2px solid #e5e7eb",
                fontWeight: 600,
                color: "#111827",
                bgcolor: "#f9fafb"
              }}
            >
              Quarto
            </Box>

            <Box sx={{ flex: 1, display: "flex", overflowX: "auto" }}>
              {visibleDays.map((day, index) => {
                const today = isSameDay(day, new Date());
                const weekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <Box
                    key={index}
                    sx={{
                      minWidth: `${100 / DAYS_TO_SHOW}%`,
                      flex: 1,
                      p: 1.5,
                      textAlign: "center",
                      borderRight: index < visibleDays.length - 1 ? "1px solid #e5e7eb" : "none",
                      bgcolor: weekend ? "#f9fafb" : "white",
                      position: "relative"
                    }}
                  >
                    {today && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          bgcolor: "#2563eb"
                        }}
                      />
                    )}
                    <Typography
                      variant="caption"
                      display="block"
                      color={today ? "#2563eb" : "#6b7280"}
                      fontWeight={today ? 700 : 500}
                      sx={{ fontSize: "0.7rem" }}
                    >
                      {format(day, "EEE", { locale: ptBR }).toUpperCase()}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={today ? 700 : 600}
                      color={today ? "#2563eb" : "#111827"}
                      sx={{ fontSize: "0.95rem" }}
                    >
                      {format(day, "dd", { locale: ptBR })}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box sx={{ overflowY: "auto", maxHeight: "calc(100vh - 320px)" }}>
            {filteredRoomGroups.map((group) => (
              <Box
                key={group.room.id}
                sx={{
                  display: "flex",
                  borderBottom: "1px solid #e5e7eb",
                  minHeight: 70,
                  "&:hover": { bgcolor: "#f9fafb" },
                  transition: "background-color 0.2s"
                }}
              >
                <Box
                  sx={{
                    width: 140,
                    p: 2,
                    borderRight: "2px solid #e5e7eb",
                    bgcolor: "white",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center"
                  }}
                >
                  <Typography variant="body1" fontWeight={700} color="#111827">
                    {group.room.number}
                  </Typography>
                  <Typography variant="caption" color="#6b7280" sx={{ fontSize: "0.7rem" }}>
                    {group.room.type}
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, position: "relative", display: "flex" }}>
                  <Box sx={{ position: "absolute", width: "100%", height: "100%", display: "flex" }}>
                    {visibleDays.map((day, index) => {
                      const weekend = day.getDay() === 0 || day.getDay() === 6;
                      const today = isSameDay(day, new Date());

                      return (
                        <Box
                          key={index}
                          sx={{
                            flex: 1,
                            borderRight: index < visibleDays.length - 1 ? "1px solid #f3f4f6" : "none",
                            bgcolor: weekend ? "#fafafa" : today ? "#eff6ff" : "transparent"
                          }}
                        />
                      );
                    })}
                  </Box>

                  <Box sx={{ position: "relative", width: "100%", p: 1 }}>
                    {group.reservations.map((reservation) => {
                      const position = overlapsVisiblePeriod(
                        reservation.checkInDate,
                        reservation.checkOutDate,
                        currentWeekStart,
                        periodEnd
                      );
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
                                Check-in: {format(new Date(reservation.checkInDate), "dd/MM/yyyy")}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Check-out: {format(new Date(reservation.checkOutDate), "dd/MM/yyyy")}
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
                              position: "absolute",
                              left: position.left,
                              width: position.width,
                              minWidth: "40px",
                              top: 4,
                              bottom: 4,
                              cursor: "pointer",
                              bgcolor: statusColor(reservation.status),
                              color: "white",
                              transition: "all 0.2s",
                              border: "none",
                              borderRadius: 1.5,
                              display: "flex",
                              alignItems: "center",
                              px: 1,
                              overflow: "hidden",
                              "&:hover": {
                                transform: "translateY(-2px)",
                                boxShadow: 4,
                                zIndex: 100
                              }
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight={600}
                              sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontSize: "0.7rem"
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

        <Paper
          elevation={0}
          sx={{
            mt: 2,
            p: 2,
            bgcolor: "white",
            borderRadius: 2,
            border: "1px solid #e5e7eb"
          }}
        >
          <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 16, height: 16, bgcolor: "#2563eb", borderRadius: 0.5 }} />
              <Typography variant="caption" color="#6b7280">
                Confirmada
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 16, height: 16, bgcolor: "#f59e0b", borderRadius: 0.5 }} />
              <Typography variant="caption" color="#6b7280">
                Pendente
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 16, height: 16, bgcolor: "#10b981", borderRadius: 0.5 }} />
              <Typography variant="caption" color="#6b7280">
                Em andamento
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 16, height: 16, bgcolor: "#8b5cf6", borderRadius: 0.5 }} />
              <Typography variant="caption" color="#6b7280">
                Concluida
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        <ModalNovaReserva
          open={openModalReserva}
          onClose={() => setOpenModalReserva(false)}
          onSuccess={() => {
            setOpenModalReserva(false);
            onReservationCreated?.();
          }}
          rooms={rooms}
        />
      </Box>
    );
  }
);

ReservationTimeline.displayName = "ReservationTimeline";

export default ReservationTimeline;
