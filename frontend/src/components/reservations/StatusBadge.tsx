import { Chip } from "@mui/material";
import { ReservationStatus } from "../../types/reservations";

interface StatusBadgeProps {
  status: ReservationStatus;
  size?: "small" | "medium";
}

const statusColors: Record<
  ReservationStatus,
  { color: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"; label: string }
> = {
  Pendente: { color: "warning", label: "Pendente" },
  Confirmada: { color: "info", label: "Confirmada" },
  EmAndamento: { color: "primary", label: "Em Andamento" },
  Concluida: { color: "success", label: "Concluída" },
  Concluída: { color: "success", label: "Concluída" },
  Cancelada: { color: "error", label: "Cancelada" }
};

export default function StatusBadge({ status, size = "small" }: StatusBadgeProps) {
  const config = statusColors[status] ?? { color: "default" as const, label: status };

  return <Chip label={config.label} color={config.color} size={size} sx={{ fontWeight: 600 }} />;
}
