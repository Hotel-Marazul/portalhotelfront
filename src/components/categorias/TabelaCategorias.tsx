"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
  Box,
} from "@mui/material";
import { FaCog } from "react-icons/fa";
import { Category } from "@/utils/models";

interface TabelaCategoriasProps {
  categoria: Category[];
  onEditar: (categoria: Category) => void;
}

export default function TabelaCategorias({ categoria, onEditar }: TabelaCategoriasProps) {
  return (
    <TableContainer component={Paper} className="mt-4 shadow-md rounded-lg">
      {/* Cabeçalho dentro do container */}
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
          Lista de Categorias ({categoria.length})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Gerencie as categorias e seus preços.
        </Typography>
      </Box>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell align="center"><b>Tipo</b></TableCell>
            <TableCell align="center"><b>Preço/Diária</b></TableCell>
            <TableCell align="center"><b>Ações</b></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {categoria.map((q) => (
            <TableRow key={q.id} hover>
              <TableCell align="center">{q.name}</TableCell>
              <TableCell align="center">R${q.price.toFixed(2)}</TableCell>
              <TableCell align="center">
                <IconButton color="primary" onClick={() => onEditar(q)}>
                  <FaCog />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}

          {categoria.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center" className="text-gray-500 py-6">
                Nenhuma categoria encontrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
