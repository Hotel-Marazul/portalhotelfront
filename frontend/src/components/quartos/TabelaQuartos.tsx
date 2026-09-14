"use client";

import {
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { FiSettings } from "react-icons/fi";
import { Room } from "../../utils/models";
import {
  normalizeOperationalRoomStatus,
  roomStatusLabel,
} from "../../utils/roomStatus";

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeOperationalRoomStatus(status);

  const styles: Record<string, React.CSSProperties> = {
    Disponivel: {
      background: "#dcfce7",
      color: "#166534",
    },
    Manutencao: {
      background: "#fef3c7",
      color: "#92400e",
    },
  };

  const style = styles[normalized] ?? { background: "#f1f5f9", color: "#475569" };

  return (
    <span
      style={{
        ...style,
        display: "inline-block",
        padding: "3px 10px",
        fontSize: "0.72rem",
        fontWeight: 600,
        borderRadius: "6px",
        letterSpacing: "0.02em",
      }}
    >
      {roomStatusLabel(normalized)}
    </span>
  );
}

interface TabelaQuartosProps {
  quartos: Room[];
  onEditar: (quarto: Room) => void;
}

export default function TabelaQuartos({ quartos, onEditar }: TabelaQuartosProps) {
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{ mt: 2, border: "1px solid var(--border)", borderRadius: "12px" }}
    >
      {/* Table header bar */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--surface)",
        }}
      >
        <span
          style={{
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Lista de Quartos{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            ({quartos.length})
          </span>
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            color: "var(--text-muted)",
          }}
        >
          Gerencie os quartos do hotel
        </span>
      </div>

      <Table aria-label="Quartos do hotel">
        <TableHead>
          <TableRow>
            <TableCell align="center">Número</TableCell>
            <TableCell align="center">Tipo</TableCell>
            <TableCell align="center">Capacidade</TableCell>
            <TableCell align="center">Status</TableCell>
            <TableCell align="center">Preço / Diária</TableCell>
            <TableCell align="center">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {quartos.map((room) => (
            <TableRow key={room.id} hover>
              <TableCell align="center" sx={{ fontWeight: 500 }}>
                {room.number}
              </TableCell>
              <TableCell align="center">{room.type}</TableCell>
              <TableCell align="center">{room.capacity}</TableCell>
              <TableCell align="center">
                <StatusBadge status={room.status} />
              </TableCell>
              <TableCell align="center" sx={{ fontFamily: "var(--font-display)", fontSize: "1rem" }}>
                R$ {room.price.toFixed(2)}
              </TableCell>
              <TableCell align="center">
                <IconButton
                  size="small"
                  aria-label={`Editar quarto ${room.number}`}
                  onClick={() => onEditar(room)}
                  sx={{
                    color: "var(--text-muted)",
                    "&:hover": { color: "var(--accent)", background: "var(--accent-dim)" },
                  }}
                >
                  <FiSettings size={16} />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}

          {quartos.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                align="center"
                sx={{ color: "var(--text-muted)", py: 4 }}
              >
                Nenhum quarto encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
