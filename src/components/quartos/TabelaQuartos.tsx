"use client";

import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from "@mui/material";
import { FaCog } from "react-icons/fa";
import { Room } from "@/utils/models"; // usando a interface já existente

// Badge estilo bootstrap
function StatusBadge({ status }: { status: string }) {
  let className =
    "inline-block px-3 py-1 text-xs font-semibold rounded-full"; // pill bem arredondado

  switch (status.toLowerCase()) {
    case "livre":
      className += " bg-green-100 text-green-800"; // fundo claro + texto escuro
      break;
    case "ocupado":
      className += " bg-red-100 text-red-800";
      break;
    case "manutenção":
      className += " bg-yellow-100 text-yellow-800";
      break;
    default:
      className += " bg-gray-200 text-gray-800";
      break;
  }

  return <span className={className}>{status}</span>;
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
          alignItems: "center",
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
            <TableCell align="center"><b>Número</b></TableCell>
            <TableCell align="center"><b>Tipo</b></TableCell>
            <TableCell align="center"><b>Capacidade</b></TableCell>
            <TableCell align="center"><b>Status</b></TableCell>
            <TableCell align="center"><b>Preço/Diária</b></TableCell>
            <TableCell align="center"><b>Ações</b></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {quartos.map((q) => (
            <TableRow key={q.id} hover>
              <TableCell align="center">{q.number}</TableCell>
              <TableCell align="center">{q.type}</TableCell>
              <TableCell align="center">{q.capacity}</TableCell>
              <TableCell align="center"><StatusBadge status={q.status} /></TableCell>
              <TableCell align="center">R${q.price.toFixed(2)}</TableCell>
              <TableCell align="center">
              <IconButton
                  color="primary"
                  onClick={() => onEditar(q)}
                >
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
