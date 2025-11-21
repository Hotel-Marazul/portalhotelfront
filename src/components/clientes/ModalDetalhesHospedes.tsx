"use client";

import React, { useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Divider,
  Box,
  Card,
  CardContent,
} from "@mui/material";
import { Close } from "@mui/icons-material";

interface GuestSummaryDto {
  id: string;
  name: string;
  age: number;
  pricingRuleDescription: string;
  pricingRulePrice: number;
}

interface RoomSummaryDto {
  id: string;
  roomNumber: number;
  status: string;
  categoryName: string;
  categoryPrice: number;
}

interface ReservationSummaryDto {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  room: RoomSummaryDto;
  guests: GuestSummaryDto[];
}

interface ClientDto {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  fone: string;
  automovel: string;
  placa: string;
  reservations: ReservationSummaryDto[];
}

interface ModalDetalhesClienteProps {
  open: boolean;
  onClose: () => void;
  cliente: ClientDto | null;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR");

const formatCurrencyBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

function DadosPessoais({ cliente }: { cliente: ClientDto }) {
  return (
    <Box>
      <Typography variant="subtitle1" className="font-semibold text-gray-700">
        Dados Pessoais
      </Typography>
      <Divider className="my-2" />
      <Box className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Box>
          <Typography>
            <strong>Nome:</strong> {cliente.fullName}
          </Typography>
          <Typography>
            <strong>CPF:</strong> {cliente.cpf}
          </Typography>
          <Typography>
            <strong>Email:</strong> {cliente.email}
          </Typography>
        </Box>
        <Box>
          <Typography>
            <strong>Fone:</strong> {cliente.fone}
          </Typography>
          <Typography>
            <strong>Automóvel:</strong> {cliente.automovel || "-"}
          </Typography>
          <Typography>
            <strong>Placa:</strong> {cliente.placa || "-"}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function HospedesLista({ guests }: { guests: GuestSummaryDto[] }) {
  if (!guests.length) {
    return (
      <Typography className="text-gray-500 italic">Nenhum hóspede.</Typography>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
      {guests.map((hospede) => (
        <Box
          key={hospede.id}
          className="bg-gray-50 rounded-lg p-3 border border-gray-100"
        >
          <Typography>
            <strong>Nome:</strong> {hospede.name}
          </Typography>
          <Typography>
            <strong>Idade:</strong> {hospede.age}
          </Typography>
          <Typography>
            <strong>Regra:</strong> {hospede.pricingRuleDescription}
          </Typography>
          <Typography>
            <strong>Valor:</strong> {formatCurrencyBRL(hospede.pricingRulePrice)}
          </Typography>
        </Box>
      ))}
    </div>
  );
}

function ReservaCard({
  reserva,
  index,
}: {
  reserva: ReservationSummaryDto;
  index: number;
}) {
  const checkIn = useMemo(
    () => formatDate(reserva.checkInDate),
    [reserva.checkInDate]
  );
  const checkOut = useMemo(
    () => formatDate(reserva.checkOutDate),
    [reserva.checkOutDate]
  );
  const total = useMemo(
    () => formatCurrencyBRL(reserva.totalPrice),
    [reserva.totalPrice]
  );
  const categoriaPreco = useMemo(
    () => formatCurrencyBRL(reserva.room.categoryPrice),
    [reserva.room.categoryPrice]
  );

  return (
    <Card className="border border-gray-200 rounded-xl shadow-sm">
      <CardContent className="space-y-4">
        <Box className="flex justify-between items-center gap-4">
          <Typography className="font-semibold text-gray-800">
            Reserva #{index + 1} - {reserva.status}
          </Typography>
          <Typography className="text-sm text-gray-600">
            Total: {total}
          </Typography>
        </Box>

        <Box className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Box>
            <Typography>
              <strong>Check-in:</strong> {checkIn}
            </Typography>
            <Typography>
              <strong>Check-out:</strong> {checkOut}
            </Typography>
          </Box>
          <Box>
            <Typography>
              <strong>Quarto:</strong> {reserva.room.roomNumber}
            </Typography>
            <Typography>
              <strong>Status do quarto:</strong> {reserva.room.status}
            </Typography>
            <Typography>
              <strong>Categoria:</strong> {reserva.room.categoryName} -{" "}
              {categoriaPreco}
            </Typography>
          </Box>
        </Box>

        <Box>
          <Typography
            variant="body1"
            className="font-semibold text-gray-700"
          >
            Hóspedes Adicionais
          </Typography>
          <Divider className="my-1" />
          <HospedesLista guests={reserva.guests} />
        </Box>
      </CardContent>
    </Card>
  );
}

export default function ModalDetalhesHospedes({
  open,
  onClose,
  cliente,
}: ModalDetalhesClienteProps) {
  if (!cliente) return null;

  const dialogTitleId = "detalhes-cliente-title";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby={dialogTitleId}
      PaperProps={{
        className:
          "bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden",
      }}
    >
      <DialogTitle
        id={dialogTitleId}
        component="div"
        className="flex justify-between items-center border-b border-gray-200"
      >
        <Typography variant="h6" className="font-semibold text-gray-800">
          Detalhes do Cliente
        </Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent className="space-y-6 p-6">
        <DadosPessoais cliente={cliente} />

        <Box>
          <Typography
            variant="subtitle1"
            className="font-semibold text-gray-700"
          >
            Reservas
          </Typography>
          <Divider className="my-2" />

          {cliente.reservations.length === 0 && (
            <Typography className="text-gray-500 italic">
              Nenhuma reserva encontrada.
            </Typography>
          )}

          {cliente.reservations.length > 0 && (
            <div className="space-y-4 mt-3">
              {cliente.reservations.map((reserva, index) => (
                <ReservaCard
                  key={reserva.id ?? index}
                  reserva={reserva}
                  index={index}
                />
              ))}
            </div>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
