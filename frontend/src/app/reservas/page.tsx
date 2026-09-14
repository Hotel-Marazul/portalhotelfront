"use client";

import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from "@mui/material";
import { Visibility, Edit, Delete } from "@mui/icons-material";
import apiClient from "../../services/api";
import {
  ReservationDto,
  ReservationsFilters,
  ReservationStatus,
  ReservationsResponse
} from "../../types/reservations";
import ReservationsFiltersComponent from "../../components/reservations/ReservationsFilters";
import ReservationDrawer from "../../components/reservations/ReservationDrawer";
import PageHeader from "../../components/layout/PageHeader";
import PageSection from "../../components/layout/PageSection";
import { addReservationCalendarDays, formatReservationCalendarDate, formatReservationDisplayDate, toReservationCalendarDate } from "../../utils/reservation";
import { useCachedFetch } from "../../hooks/useCachedFetch";
import { usePersistentUiState } from "../../hooks/usePersistentUiState";
import ReservationWorkspaceSwitcher, { type ReservationWorkspaceView } from "../../components/reservations/ReservationWorkspaceSwitcher";
import type { TimelineRoom } from "../../components/clientes/TimelineGrid";
import { getIdempotencyAttempt } from "../../utils/idempotency";
import { apiErrorMessage } from "../../utils/api-error";

const ReservationTimeline = lazy(() => import("../../components/clientes/ReservationTimeline"));
const AGENDA_PAGE_SIZE = 100;
function isWorkspaceView(value: unknown): value is ReservationWorkspaceView {
  return value === "agenda" || value === "lista";
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(iso?: string) {
  return iso ? formatReservationDisplayDate(iso) : "";
}

function normalizeStatus(status: ReservationStatus): ReservationStatus {
  return status === "Concluida" ? "Concluída" : status;
}

function chipColor(status: ReservationStatus) {
  switch (normalizeStatus(status)) {
    case "Confirmada":
      return "success";
    case "Pendente":
      return "warning";
    case "Cancelada":
      return "error";
    case "Concluída":
      return "info";
    case "EmAndamento":
      return "primary";
    default:
      return "default";
  }
}

export default function ReservationsPage() {
  const [allReservations, setAllReservations] = useState<ReservationDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ReservationsFilters>({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [workspaceView, setWorkspaceView] = usePersistentUiState(
    "agenda:view",
    "agenda",
    isWorkspaceView,
  );

  const {
    data: agendaRooms,
    loading: loadingAgendaRooms,
    error: agendaRoomsError,
    refetch: refetchAgendaRooms,
  } = useCachedFetch<TimelineRoom[]>("/api/rooms", {
    cacheKey: "agenda:rooms",
    expiresIn: 5 * 60 * 1000,
  });
  const [agendaReservations, setAgendaReservations] = useState<ReservationsResponse | null>(null);
  const [loadingAgendaReservations, setLoadingAgendaReservations] = useState(true);
  const [agendaReservationsError, setAgendaReservationsError] = useState<string | null>(null);
  const agendaRequestId = useRef(0);
  const reservationRequestId = useRef(0);

  const [editing, setEditing] = useState<ReservationDto | null>(null);
  const [deleting, setDeleting] = useState<ReservationDto | null>(null);
  const [viewing, setViewing] = useState<ReservationDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const saveSubmittingRef = useRef(false);
  const removeSubmittingRef = useRef(false);
  const statusSubmittingRef = useRef(false);
  const [editIdempotencyKey, setEditIdempotencyKey] = useState<string | null>(null);
  const [editAttemptFingerprint, setEditAttemptFingerprint] = useState<string | null>(null);
  const [cancelIdempotencyKey, setCancelIdempotencyKey] = useState<string | null>(null);
  const [cancelAttemptFingerprint, setCancelAttemptFingerprint] = useState<string | null>(null);
  const [statusAttempt, setStatusAttempt] = useState<{ fingerprint: string; key: string } | null>(null);

  const loadReservations = useCallback(async (
    targetPage: number,
    targetLimit: number,
    activeFilters: ReservationsFilters = {},
  ) => {
    const requestId = ++reservationRequestId.current;
    setLoading(true);
    setError(null);
    try {
      // MUI usa base-0; backend usa base-1
      // Filters are sent as query params so the backend applies them server-side,
      // returning a filtered total — this keeps TablePagination counts correct.
      const res = await apiClient.get<ReservationsResponse>("/api/reservations", {
        params: {
          page: targetPage + 1,
          limit: targetLimit,
          ...(activeFilters.status?.length ? { status: activeFilters.status.join(",") } : {}),
          ...(activeFilters.search ? { search: activeFilters.search } : {}),
          ...(activeFilters.roomId ? { roomId: activeFilters.roomId } : {}),
          ...(activeFilters.checkInFrom ? { checkInFrom: activeFilters.checkInFrom } : {}),
          ...(activeFilters.checkInTo ? { checkInTo: activeFilters.checkInTo } : {}),
          ...(activeFilters.checkOutFrom ? { checkOutFrom: activeFilters.checkOutFrom } : {}),
          ...(activeFilters.checkOutTo ? { checkOutTo: activeFilters.checkOutTo } : {})
        }
      });
      if (requestId !== reservationRequestId.current) return;
      const envelope = res.data;
      const nextTotal = typeof envelope.total === "number" ? envelope.total : 0;
      setAllReservations(Array.isArray(envelope.items) ? envelope.items : []);
      setTotalCount(nextTotal);
      const lastPage = Math.max(0, Math.ceil(nextTotal / targetLimit) - 1);
      if (targetPage > lastPage) setPage(lastPage);
    } catch (e: unknown) {
      if (requestId !== reservationRequestId.current) return;
      setError(apiErrorMessage(e, "Erro ao carregar reservas"));
      setAllReservations([]);
      setTotalCount(0);
    } finally {
      if (requestId === reservationRequestId.current) setLoading(false);
    }
  }, []);

  const loadAgendaReservations = useCallback(async (periodStart: string, periodDays: 7 | 14) => {
    const requestId = ++agendaRequestId.current;
    const periodEnd = addReservationCalendarDays(periodStart, periodDays);
    const lastVisibleDate = addReservationCalendarDays(periodEnd, -1);
    const checkInTo = formatReservationCalendarDate(lastVisibleDate);
    if (!checkInTo) {
      setAgendaReservations(null);
      setAgendaReservationsError("Período inválido para a agenda.");
      setLoadingAgendaReservations(false);
      return;
    }

    setLoadingAgendaReservations(true);
    setAgendaReservationsError(null);
    setAgendaReservations(null);
    try {
      const params = {
        limit: AGENDA_PAGE_SIZE,
        checkInTo,
        checkOutFrom: periodStart,
      };
      const firstResponse = await apiClient.get<ReservationsResponse>("/api/reservations", { params: { ...params, page: 1 } });
      const total = typeof firstResponse.data.total === "number" ? firstResponse.data.total : firstResponse.data.items.length;
      const items = [...(firstResponse.data.items ?? [])];
      const pageCount = Math.ceil(total / AGENDA_PAGE_SIZE);
      for (let currentPage = 2; currentPage <= pageCount; currentPage += 1) {
        const response = await apiClient.get<ReservationsResponse>("/api/reservations", { params: { ...params, page: currentPage } });
        items.push(...(response.data.items ?? []));
      }
      if (requestId !== agendaRequestId.current) return;
      setAgendaReservations({ items, total, page: 1, pageSize: AGENDA_PAGE_SIZE });
    } catch (requestError) {
      if (requestId !== agendaRequestId.current) return;
      setAgendaReservations(null);
      setAgendaReservationsError(apiErrorMessage(requestError, "Não foi possível carregar as reservas da agenda."));
    } finally {
      if (requestId === agendaRequestId.current) setLoadingAgendaReservations(false);
    }
  }, []);

  useEffect(() => {
    void loadReservations(page, rowsPerPage, filters);
  }, [loadReservations, page, rowsPerPage, filters]);

  // Filters are applied server-side; allReservations already reflects the active
  // filter state. The backend returns results sorted by check_in_date DESC.

  const handleSave = async () => {
    if (!editing || saveSubmittingRef.current) return;

    saveSubmittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const pricing = editing.pricing;
      const dailyRateOverride = pricing?.priceSource === "manual" ? pricing.dailyRate : undefined;
      const discountAmount = pricing ? pricing.discountAmount : undefined;
      const priceOverrideReason = pricing?.overrideReason ??
        (dailyRateOverride !== undefined || (discountAmount ?? 0) > 0
          ? "Ajuste manual registrado anteriormente"
          : undefined);
      const payload = {
        roomId: editing.roomId,
        clientId: editing.clientId,
        checkInDate: toReservationCalendarDate(editing.checkInDate),
        checkOutDate: toReservationCalendarDate(editing.checkOutDate),
        guests: (editing.guests ?? []).map((guest) => ({
          name: guest.name,
          age: guest.age,
          pricingRuleId: guest.pricingRuleId ?? null
        })),
        ...(dailyRateOverride !== undefined ? { dailyRateOverride } : {}),
        ...(discountAmount !== undefined ? { discountAmount } : {}),
        ...(priceOverrideReason ? { priceOverrideReason } : {}),
        version: editing.version
      };
      const attempt = getIdempotencyAttempt(
        editIdempotencyKey && editAttemptFingerprint
          ? { key: editIdempotencyKey, fingerprint: editAttemptFingerprint }
          : null,
        payload,
      );
      setEditIdempotencyKey(attempt.key);
      setEditAttemptFingerprint(attempt.fingerprint);

      await apiClient.put<ReservationDto>(`/api/reservations/${editing.id}`, { ...payload, idempotencyKey: attempt.key });
      setEditing(null);
      setEditIdempotencyKey(null);
      setEditAttemptFingerprint(null);
      void loadReservations(page, rowsPerPage, filters);
      if (agendaPeriod) void loadAgendaReservations(agendaPeriod.start, agendaPeriod.days);
    } catch (e: unknown) {
      setError(apiErrorMessage(e, "Erro ao salvar edição"));
    } finally {
      saveSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!deleting || removeSubmittingRef.current) return;

    removeSubmittingRef.current = true;
    setRemoving(true);
    setError(null);
    try {
      const payload = {
        version: deleting.version,
        reason: "Cancelamento confirmado pela operação."
      };
      const attempt = getIdempotencyAttempt(
        cancelIdempotencyKey && cancelAttemptFingerprint
          ? { key: cancelIdempotencyKey, fingerprint: cancelAttemptFingerprint }
          : null,
        { reservationId: deleting.id, ...payload },
      );
      setCancelIdempotencyKey(attempt.key);
      setCancelAttemptFingerprint(attempt.fingerprint);
      await apiClient.post(`/api/reservations/${deleting.id}/cancel`, {
        ...payload,
        idempotencyKey: attempt.key
      });
      setDeleting(null);
      setCancelIdempotencyKey(null);
      setCancelAttemptFingerprint(null);
      void loadReservations(page, rowsPerPage, filters);
      if (agendaPeriod) void loadAgendaReservations(agendaPeriod.start, agendaPeriod.days);
    } catch (e: unknown) {
      setError(apiErrorMessage(e, "Erro ao remover"));
    } finally {
      removeSubmittingRef.current = false;
      setRemoving(false);
    }
  };

  const [agendaPeriod, setAgendaPeriod] = useState<{ start: string; days: 7 | 14 } | null>(null);
  const handleAgendaPeriodChange = useCallback((start: string, days: 7 | 14) => {
    setAgendaPeriod((current) => current?.start === start && current.days === days ? current : { start, days });
    void loadAgendaReservations(start, days);
  }, [loadAgendaReservations, setAgendaPeriod]);
  const refreshAgenda = useCallback(() => {
    refetchAgendaRooms();
    if (agendaPeriod) void loadAgendaReservations(agendaPeriod.start, agendaPeriod.days);
    void loadReservations(page, rowsPerPage, filters);
  }, [agendaPeriod, filters, loadAgendaReservations, loadReservations, page, refetchAgendaRooms, rowsPerPage]);

  const agendaError = agendaRoomsError || agendaReservationsError;

  return (
    <Box className="page-content">
      <PageHeader
        title="Agenda"
        description="Veja ocupação, disponibilidade e reservas sem interromper a operação."
        actions={<Button variant="outlined" onClick={refreshAgenda}>Atualizar</Button>}
      />

      <ReservationWorkspaceSwitcher value={workspaceView} onChange={setWorkspaceView} />

      {workspaceView === "agenda" && (
        <PageSection
          title="Ocupação e disponibilidade"
          description="Consulte os próximos dias, encontre um quarto e inicie uma reserva no mesmo lugar."
        >
          {loadingAgendaRooms && (
            <Box className="flex items-center justify-center py-10" aria-label="Carregando agenda">
              <CircularProgress size={28} />
            </Box>
          )}
          {!loadingAgendaRooms && agendaError && (
            <Alert
              severity="error"
              action={<Button color="inherit" size="small" onClick={refreshAgenda}>Tentar novamente</Button>}
            >
              {agendaError}
            </Alert>
          )}
          {!loadingAgendaRooms && !agendaError && (
            <Suspense fallback={<Box className="flex items-center justify-center py-10"><CircularProgress size={28} /></Box>}>
              <ReservationTimeline
                rooms={agendaRooms ?? []}
                reservations={agendaReservations?.items ?? []}
                totalReservations={agendaReservations?.total ?? 0}
                reservationsLoading={loadingAgendaReservations}
                onPeriodChange={handleAgendaPeriodChange}
                onReservationCreated={refreshAgenda}
              />
            </Suspense>
          )}
        </PageSection>
      )}

      {workspaceView === "lista" && <>
      <Box>
        <PageSection
          title="Filtros"
          description="Refine a busca por status, nome e período."
          actions={
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: "999px",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                fontSize: "0.78rem",
                background: "var(--surface-alt)",
              }}
            >
              {Object.values(filters).filter(Boolean).length > 0 ? "Filtros ativos" : "Sem filtros"}
            </span>
          }
        >
          <ReservationsFiltersComponent
            filters={filters}
            onFiltersChange={(partial) => {
              setFilters((previous) => ({ ...previous, ...partial }));
              setPage(0);
            }}
            onClear={() => {
              setFilters({});
              setPage(0);
            }}
          />
        </PageSection>
      </Box>

      <Box >
        <PageSection
          title="Lista de reservas"
          description="Acompanhe status, datas e valores da operação diária."
          actions={
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: "999px",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                fontSize: "0.78rem",
                background: "var(--surface-alt)",
              }}
            >
              {totalCount} resultado(s)
            </span>
          }
        >
          <TableContainer component={Paper}>
            {loading && (
              <Box className="flex items-center justify-center py-10">
                <CircularProgress size={28} />
              </Box>
            )}

            {error && (
              <Box className="p-4">
                <Alert severity="error">{error}</Alert>
              </Box>
            )}

            {!loading && !error && (
              <>
                <Table size="small" aria-label="Lista de Reservas">
                  <TableHead>
                    <TableRow>
                      <TableCell>Hóspede</TableCell>
                      <TableCell>Quarto</TableCell>
                      <TableCell>Check-in</TableCell>
                      <TableCell>Check-out</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Valor Total</TableCell>
                      <TableCell align="center">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allReservations.length > 0 ? (
                      allReservations.map((reservation) => (
                        <TableRow key={reservation.id} hover>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {reservation.client?.fullName ?? reservation.client?.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{reservation.room?.number}</TableCell>
                          <TableCell>{formatDate(reservation.checkInDate)}</TableCell>
                          <TableCell>{formatDate(reservation.checkOutDate)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={normalizeStatus(reservation.status)}
                              color={chipColor(reservation.status)}
                              sx={{ textTransform: "capitalize" }}
                            />
                          </TableCell>
                          <TableCell>{brl.format(reservation.totalPrice ?? 0)}</TableCell>
                          <TableCell align="center">
                            <div className="flex items-center justify-center gap-1">
                              <IconButton
                                size="small"
                                aria-label="ver"
                                onClick={() => setViewing(reservation)}
                              >
                                <Visibility />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="editar"
                                color="primary"
                                disabled={reservation.status === "Cancelada" || reservation.status === "Concluída" || reservation.status === "Concluida"}
                                onClick={() => {
                                  setEditing(reservation);
                                  setEditIdempotencyKey(null);
                                  setEditAttemptFingerprint(null);
                                }}
                              >
                                <Edit />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="cancelar"
                                color="error"
                                disabled={reservation.status === "Cancelada" || reservation.status === "Concluída" || reservation.status === "Concluida"}
                                onClick={() => {
                                  setDeleting(reservation);
                                  setCancelIdempotencyKey(null);
                                  setCancelAttemptFingerprint(null);
                                }}
                              >
                                <Delete />
                              </IconButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Typography variant="body2" className="text-center py-6">
                            Nenhuma reserva encontrada
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <Box className="px-4 sm:px-6 py-2">
                  <TablePagination
                    component="div"
                    count={totalCount}
                    page={page}
                    onPageChange={(_event, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(event) => {
                      setRowsPerPage(parseInt(event.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[10, 20, 50, 100]}
                  />
                </Box>
              </>
            )}
          </TableContainer>
        </PageSection>
      </Box>
      </>}

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Editar Reserva</DialogTitle>
        <DialogContent>
          <TextField
            label="Check-in"
            type="date"
            fullWidth
            value={editing ? toReservationCalendarDate(editing.checkInDate) : ""}
            onChange={(event) =>
              editing && setEditing({ ...editing, checkInDate: event.target.value })
            }
            InputLabelProps={{ shrink: true }}
            margin="normal"
          />
          <TextField
            label="Check-out"
            type="date"
            fullWidth
            value={editing ? toReservationCalendarDate(editing.checkOutDate) : ""}
            onChange={(event) =>
              editing && setEditing({ ...editing, checkOutDate: event.target.value })
            }
            InputLabelProps={{ shrink: true }}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancelar</Button>
          <Button variant="contained" disabled={saving} onClick={() => void handleSave()}>
            {saving ? <CircularProgress size={18} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogTitle>Confirmação</DialogTitle>
        <DialogContent>
          Tem certeza que deseja cancelar a reserva de <b>{deleting?.client?.fullName}</b>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button color="error" variant="contained" disabled={removing} onClick={() => void handleRemove()}>
            {removing ? <CircularProgress size={18} /> : "Cancelar reserva"}
          </Button>
        </DialogActions>
      </Dialog>

      <ReservationDrawer
        open={!!viewing}
        reservation={viewing}
        mode="view"
        onClose={() => setViewing(null)}
        onSave={(updated) => {
          setAllReservations((prev) => prev.map((r) => r.id === updated.id ? updated : r));
          setViewing(updated);
        }}
        onStatusChange={async (id, status) => {
          if (statusSubmittingRef.current) return;
          statusSubmittingRef.current = true;
          try {
            const r = viewing!;
            const targetStatus = normalizeStatus(status);
            const attempt = getIdempotencyAttempt(
              statusAttempt,
              { id, targetStatus, version: r.version },
            );
            setStatusAttempt(attempt);
            const response = await apiClient.post<ReservationDto>(`/api/reservations/${id}/transitions`, {
              targetStatus,
              version: r.version,
              idempotencyKey: attempt.key,
              ...(targetStatus === "Cancelada" ? { reason: "Cancelamento confirmado pela operação." } : {})
            });
            setStatusAttempt(null);
            setViewing(response.data);
            void loadReservations(page, rowsPerPage, filters);
          } finally {
            statusSubmittingRef.current = false;
          }
        }}
      />
    </Box>
  );
}
