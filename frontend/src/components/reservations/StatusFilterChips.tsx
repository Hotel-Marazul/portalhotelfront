import { Box, Chip } from "@mui/material";
import { ReservationStatus } from "../../types/reservations";

interface Props {
  selected: ReservationStatus[];
  onToggle: (status: ReservationStatus) => void;
  statuses: ReservationStatus[];
}

export default function StatusFilterChips({ selected, onToggle, statuses }: Props) {
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
      {statuses.map((status) => (
        <Chip
          key={status}
          label={status}
          onClick={() => onToggle(status)}
          color={selected.includes(status) ? "primary" : "default"}
          variant={selected.includes(status) ? "filled" : "outlined"}
          size="small"
        />
      ))}
    </Box>
  );
}
