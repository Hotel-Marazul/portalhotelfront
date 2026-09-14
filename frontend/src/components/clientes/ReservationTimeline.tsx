"use client";
import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Add, ChevronLeft, ChevronRight } from "@mui/icons-material";
import type { ReservationDto } from "../../types/reservations";
import {
  addReservationCalendarDays,
  formatReservationCalendarDate,
  formatReservationDisplayDate,
  parseReservationDate,
} from "../../utils/reservation";
import { usePersistentUiState } from "../../hooks/usePersistentUiState";
import ModalNovaReserva from "./ModalNovaReserva";
import TimelineAvailability from "./TimelineAvailability";
import TimelineGrid, { guestName, timelineStatus, type TimelineRoom } from "./TimelineGrid";
import styles from "./timeline.module.css";

interface Props {
  rooms: TimelineRoom[];
  reservations: ReservationDto[];
  onReservationCreated?: () => void;
  onPeriodChange?: (start: string, days: 7 | 14) => void;
  reservationsLoading?: boolean;
  totalReservations?: number;
}

interface AgendaPreferences {
  start: string;
  days: 7 | 14;
  category: string;
  status: string;
}

function isAgendaPreferences(value: unknown): value is AgendaPreferences {
  if (!value || typeof value !== "object") return false;
  const preferences = value as Record<string, unknown>;
  return typeof preferences.start === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(preferences.start)
    && (preferences.days === 7 || preferences.days === 14)
    && typeof preferences.category === "string"
    && typeof preferences.status === "string";
}

export default function ReservationTimeline({
  rooms,
  reservations,
  onReservationCreated,
  onPeriodChange,
  reservationsLoading = false,
  totalReservations = reservations.length,
}: Props) {
  const [preferences, setPreferences] = usePersistentUiState<AgendaPreferences>(
    "agenda:preferences",
    { start: formatReservationCalendarDate(new Date()), days: 14, category: "Todos", status: "Todos" },
    isAgendaPreferences,
  );
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ReservationDto | null>(null);
  const start = useMemo(() => {
    const parsed = parseReservationDate(preferences.start);
    return Number.isNaN(parsed.getTime())
      ? parseReservationDate(formatReservationCalendarDate(new Date()))
      : parsed;
  }, [preferences.start]);
  const { days, category, status } = preferences;
  const setStart = (date: Date) => setPreferences((current) => ({ ...current, start: formatReservationCalendarDate(date) }));
  const setDays = (value: 7 | 14) => setPreferences((current) => ({ ...current, days: value }));
  useEffect(() => {
    onPeriodChange?.(preferences.start, preferences.days);
  }, [onPeriodChange, preferences.start, preferences.days]);
  const setCategory = (value: string) => setPreferences((current) => ({ ...current, category: value }));
  const setStatus = (value: string) => setPreferences((current) => ({ ...current, status: value }));
  const categories = useMemo(() => [...new Set(rooms.map(room => room.type))], [rooms]);
  const filteredRooms = useMemo(() => rooms.filter(room =>
    (category === "Todos" || category === room.type) && `${room.number} ${room.type}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))
  ).sort((a, b) => a.number - b.number), [rooms, category, search]);
  const filteredReservations = reservations.filter(r => status === "Todos" || r.status.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === status);
  return <Stack spacing={2}>
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" justifyContent="space-between">
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <IconButton aria-label="Período anterior" onClick={() => setStart(addReservationCalendarDays(start, -days))}><ChevronLeft /></IconButton>
        <IconButton aria-label="Próximo período" onClick={() => setStart(addReservationCalendarDays(start, days))}><ChevronRight /></IconButton>
        <Typography component="p" variant="body2" fontWeight={600} aria-live="polite">
          {formatReservationDisplayDate(start, { day: "2-digit", month: "short" })} – {formatReservationDisplayDate(addReservationCalendarDays(start, days - 1), { day: "2-digit", month: "short", year: "numeric" })}
        </Typography>
        <Button variant="outlined" onClick={() => setStart(parseReservationDate(formatReservationCalendarDate(new Date())))}>Hoje</Button>
      </Stack>
      <Button variant="contained" disableElevation startIcon={<Add />} onClick={() => setCreating(true)}>Nova reserva</Button>
    </Stack>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "2fr 1fr 1fr 120px" }, gap: 1.5 }}>
      <TextField label="Buscar quarto" placeholder="Número ou categoria" value={search} onChange={e => setSearch(e.target.value)} />
      <TextField select label="Categoria" value={category} onChange={e => setCategory(e.target.value)}><MenuItem value="Todos">Todas as categorias</MenuItem>{categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
      <TextField select label="Status da reserva" value={status} onChange={e => setStatus(e.target.value)}><MenuItem value="Todos">Todos os status</MenuItem>{Object.entries(timelineStatus).filter(([key]) => key !== "Concluída" && key !== "Concluida").map(([key, value]) => <MenuItem key={key} value={key}>{value.label}</MenuItem>)}</TextField>
      <TextField select label="Exibir" value={days} onChange={e => setDays(Number(e.target.value) as 7 | 14)}><MenuItem value={7}>7 dias</MenuItem><MenuItem value={14}>14 dias</MenuItem></TextField>
    </Box>
    {reservationsLoading && <Alert severity="info">Atualizando as reservas deste período…</Alert>}
    {!reservationsLoading && totalReservations > reservations.length && <Alert severity="warning">Mapa parcial: {reservations.length} de {totalReservations} reservas carregadas. Confirme a disponibilidade na consulta por período antes de reservar.</Alert>}
    {status !== "Todos" && <Alert severity="info">Exibindo apenas reservas com status {timelineStatus[status]?.label}. Outras reservas podem ocupar os espaços em branco.</Alert>}
    <TimelineGrid rooms={filteredRooms} reservations={filteredReservations} start={start} days={days} onSelect={setSelected} />
    <Stack direction="row" gap={1.5} flexWrap="wrap" aria-label="Legenda dos status">
      {Object.entries(timelineStatus).filter(([key]) => key !== "Concluida").map(([key, value]) => <Box component="span" key={key} className={styles[value.tone]} sx={{ px: 1, py: 0.5, borderRadius: 1, fontSize: 12 }}>{value.label}</Box>)}
    </Stack>
    <Typography id="timeline-help" variant="caption" color="text.secondary">{filteredRooms.length} quarto(s). Role o mapa para ver os dias. Selecione uma reserva para abrir os detalhes. A barra termina na data de saída.</Typography>
    <TimelineAvailability />
    <ModalNovaReserva open={creating} onClose={() => setCreating(false)} onSuccess={() => { setCreating(false); onReservationCreated?.(); }} />
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth aria-labelledby="timeline-reservation-title">
      <DialogTitle id="timeline-reservation-title">Detalhes da reserva</DialogTitle>
      <DialogContent dividers>{selected && <Stack spacing={2}>
        <Typography fontWeight={600}>{guestName(selected)}</Typography>
        <Typography variant="body2">Quarto {selected.room?.number ?? rooms.find(r => r.id === selected.roomId)?.number ?? "não informado"} · {timelineStatus[selected.status]?.label ?? selected.status}</Typography>
        <Typography variant="body2">Entrada: {formatReservationDisplayDate(selected.checkInDate, { day: "2-digit", month: "2-digit", year: "numeric" })}<br />Saída: {formatReservationDisplayDate(selected.checkOutDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</Typography>
        <Typography variant="body2">{1 + (selected.guests?.length || 0)} pessoa(s)</Typography>
      </Stack>}</DialogContent>
      <DialogActions><Button onClick={() => setSelected(null)}>Fechar</Button></DialogActions>
    </Dialog>
  </Stack>;
}
