"use client";
import { useEffect, useState } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { isValid, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import apiClient from "../../services/api";
import {
  addReservationCalendarDays,
  formatReservationCalendarDate,
  formatReservationPickerDate,
  parseReservationPickerDate
} from "../../utils/reservation";
import type { TimelineRoom } from "./TimelineGrid";
function nextPickerDate(date: Date): Date {
    const nextCalendarDate = addReservationCalendarDays(formatReservationCalendarDate(date), 1);
    return parseReservationPickerDate(formatReservationCalendarDate(nextCalendarDate));
}

export default function TimelineAvailability() {
    const [availabilityCheckInDate, setAvailabilityCheckInDate] = useState<Date | null>(() =>
      parseReservationPickerDate(formatReservationCalendarDate(new Date()))
    );
    const [availabilityCheckOutDate, setAvailabilityCheckOutDate] = useState<Date | null>(() =>
      nextPickerDate(parseReservationPickerDate(formatReservationCalendarDate(new Date())))
    );
    const [availableRoomsForDate, setAvailableRoomsForDate] = useState<TimelineRoom[]>([]);
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [availabilityError, setAvailabilityError] = useState<string | null>(null);
    const [availabilityRetryNonce, setAvailabilityRetryNonce] = useState(0);

    useEffect(() => {
      if (!availabilityCheckInDate || !availabilityCheckOutDate || !isValid(availabilityCheckInDate) || !isValid(availabilityCheckOutDate)) return;

      const checkIn = startOfDay(availabilityCheckInDate);
      const checkOut = startOfDay(availabilityCheckOutDate);
      if (checkOut <= checkIn) {
        setAvailabilityCheckOutDate(nextPickerDate(checkIn));
      }
    }, [availabilityCheckInDate, availabilityCheckOutDate]);

    useEffect(() => {
      let cancelled = false;
      setAvailableRoomsForDate([]);
      setAvailabilityError(null);
      setLoadingAvailability(false);
      if (!availabilityCheckInDate || !availabilityCheckOutDate || !isValid(availabilityCheckInDate) || !isValid(availabilityCheckOutDate)) {
        setAvailabilityError("Informe datas válidas para consultar a disponibilidade.");
        return () => { cancelled = true; };
      }

      const checkIn = startOfDay(availabilityCheckInDate);
      const checkOut = startOfDay(availabilityCheckOutDate);

      if (checkOut <= checkIn) {
        setAvailabilityError("Check-out deve ser posterior ao check-in.");
        return () => { cancelled = true; };
      }

      setLoadingAvailability(true);

      apiClient
        .get<TimelineRoom[]>("/api/rooms/availability", {
          params: {
            checkIn: formatReservationPickerDate(checkIn),
            checkOut: formatReservationPickerDate(checkOut),
            guestCount: 1
          }
        })
        .then((response) => {
          if (cancelled) return;
          setAvailableRoomsForDate(Array.isArray(response.data) ? response.data : []);
        })
        .catch(() => {
          if (cancelled) return;
          setAvailableRoomsForDate([]);
          setAvailabilityError("Não foi possível consultar disponibilidade.");
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingAvailability(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [availabilityCheckInDate, availabilityCheckOutDate, availabilityRetryNonce]);

return <details className="availability-panel"><summary>Consultar quartos disponíveis por período</summary><div className="availability-content"><Stack direction={{ xs: "column", md: "row" }} spacing={2}>
<Box sx={{ flex: 1, minWidth: 0 }}>
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
                        ? nextPickerDate(startOfDay(availabilityCheckInDate))
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

            <Box sx={{ flex: 1 }} role="status" aria-live="polite">
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {loadingAvailability
                  ? "Consultando quartos disponíveis..."
                  : availabilityError
                    ? "Disponibilidade indisponível."
                    : `Quartos disponíveis: ${availableRoomsForDate.length}`}
              </Typography>

              {availabilityError ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="caption" color="error">
                    {availabilityError}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setAvailabilityRetryNonce((value) => value + 1)}
                    disabled={loadingAvailability}
                  >
                    Tentar novamente
                  </Button>
                </Stack>
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
                      <Typography variant="caption" color="text.secondary">
                        Nenhum quarto livre para o período selecionado.
                      </Typography>
                    )
                  )}
                </Stack>
              )}
            </Box>

</Stack></div></details>;
}
