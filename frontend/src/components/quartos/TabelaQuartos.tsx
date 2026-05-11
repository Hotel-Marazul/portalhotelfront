"use client";

import {
  Box,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { FaCog } from "react-icons/fa";
import { Room } from "../../utils/models";
import {
  normalizeOperationalRoomStatus,
  roomStatusLabel
} from "../../utils/roomStatus";

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = normalizeOperationalRoomStatus(status);
  let className = "inline-block px-3 py-1 text-xs font-semibold rounded-full";

  if (normalizedStatus === "Disponivel") {
    className += " bg-green-100 text-green-800";
  } else if (normalizedStatus === "Manutencao") {
    className += " bg-yellow-100 text-yellow-800";
  } else {
    className += " bg-gray-200 text-gray-800";
  }

  return <span className={className}>{roomStatusLabel(normalizedStatus)}</span>;
}

interface TabelaQuartosProps {
  quartos: Room[];
  onEditar: (quarto: Room) => void;
}

export default function TabelaQuartos({ quartos, onEditar }: TabelaQuartosProps) {
  return (
    <TableContainer component={Paper} className="mt-4 shadow-md rounded-lg">
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
          borderTopLeftRadius: "0.5rem",
          borderTopRightRadius: "0.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
          Lista de Quartos ({quartos.length})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Gerencie os quartos do hotel
        </Typography>
      </Box>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell align="center">
              <b>Numero</b>
            </TableCell>
            <TableCell align="center">
              <b>Tipo</b>
            </TableCell>
            <TableCell align="center">
              <b>Capacidade</b>
            </TableCell>
            <TableCell align="center">
              <b>Status operacional</b>
            </TableCell>
            <TableCell align="center">
              <b>Preco/Diaria</b>
            </TableCell>
            <TableCell align="center">
              <b>Acoes</b>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {quartos.map((room) => (
            <TableRow key={room.id} hover>
              <TableCell align="center">{room.number}</TableCell>
              <TableCell align="center">{room.type}</TableCell>
              <TableCell align="center">{room.capacity}</TableCell>
              <TableCell align="center">
                <StatusBadge status={room.status} />
              </TableCell>
              <TableCell align="center">R${room.price.toFixed(2)}</TableCell>
              <TableCell align="center">
                <IconButton color="primary" onClick={() => onEditar(room)}>
                  <FaCog />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}

          {quartos.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center" className="text-gray-500">
                Nenhum quarto encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
