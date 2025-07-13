"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";
import { Add as AddIcon, Search as SearchIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import apiClient from "@/service/api"; // ajuste o caminho conforme seu projeto

interface Cliente {
  id: string;
  fullName: string;
  cpf: string;
  fone: string;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const response = await apiClient.get("/api/Client");

        // 👇 Corrige acesso à estrutura $values
        const raw = response.data;
        const data: Cliente[] = Array.isArray(raw?.$values) ? raw.$values : [];

        setClientes(data);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        setClientes([]);
      }
    };

    fetchClientes();
  }, []);

  const filteredClientes = clientes.filter((cliente) =>
    cliente.fullName.toLowerCase().includes(search.toLowerCase()) ||
    cliente.cpf.includes(search) ||
    cliente.fone.includes(search)
  );

  const handleNovoCliente = () => {
    router.push("/cliente/create");
  };

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3, p: 2 }}>
        <Typography variant="h5" component="h2">
          Clientes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNovoCliente}
        >
          Novo Cliente
        </Button>
      </Box>

      <Paper sx={{ width: "100%", mb: 2 }}>
        <Box sx={{ p: 2, display: "flex" }}>
          <TextField
            variant="outlined"
            placeholder="Buscar clientes..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mr: 2, width: 300 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: "action.active", mr: 1 }} />,
            }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>CPF</TableCell>
                <TableCell>Telefone</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredClientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell>{cliente.fullName}</TableCell>
                  <TableCell>{cliente.cpf}</TableCell>
                  <TableCell>{cliente.fone}</TableCell>
                </TableRow>
              ))}
              {filteredClientes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}
