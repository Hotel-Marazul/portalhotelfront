"use client";

import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Typography,
    Divider,
    Box,
    Grid,
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

export default function ModalDetalhesHospedes({
    open,
    onClose,
    cliente,
}: ModalDetalhesClienteProps) {
    if (!cliente) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            PaperProps={{
                className:
                    "bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden",
            }}
        >
            {/* Header */}
            <DialogTitle component="div" className="flex justify-between items-center border-b border-gray-200">
                <Typography variant="h6" className="font-semibold text-gray-800">
                    Detalhes do Cliente
                </Typography>
                <IconButton onClick={onClose}>
                    <Close />
                </IconButton>
            </DialogTitle>

            {/* Conteúdo */}
            <DialogContent className="space-y-6 p-6">
                {/* Dados do cliente */}
                <Box>
                    <Typography variant="subtitle1" className="font-semibold text-gray-700">
                        Dados Pessoais
                    </Typography>
                    <Divider className="my-2" />
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} {...({} as any)}>

                            <Typography><strong>Nome:</strong> {cliente.fullName}</Typography>
                            <Typography><strong>CPF:</strong> {cliente.cpf}</Typography>
                            <Typography><strong>Email:</strong> {cliente.email}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} {...({} as any)}>

                            <Typography><strong>Fone:</strong> {cliente.fone}</Typography>
                            <Typography><strong>Automóvel:</strong> {cliente.automovel}</Typography>
                            <Typography><strong>Placa:</strong> {cliente.placa}</Typography>
                        </Grid>
                    </Grid>
                </Box>

                {/* Reservas */}
                <Box>
                    <Typography variant="subtitle1" className="font-semibold text-gray-700">
                        Reservas
                    </Typography>
                    <Divider className="my-2" />

                    {cliente.reservations.length === 0 && (
                        <Typography className="text-gray-500 italic">
                            Nenhuma reserva encontrada.
                        </Typography>
                    )}

                    <div className="space-y-4 mt-3">
                        {cliente.reservations.map((reserva, index) => (
                            <Card key={index} className="border border-gray-200 rounded-xl shadow-sm">
                                <CardContent className="space-y-4">
                                    <Box className="flex justify-between items-center">
                                        <Typography className="font-semibold text-gray-800">
                                            Reserva #{index + 1} - {reserva.status}
                                        </Typography>
                                        <Typography className="text-sm text-gray-600">
                                            Total: R$ {reserva.totalPrice.toFixed(2)}
                                        </Typography>
                                    </Box>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6} {...({} as any)}>

                                            <Typography><strong>Check-in:</strong> {new Date(reserva.checkInDate).toLocaleDateString()}</Typography>
                                            <Typography><strong>Check-out:</strong> {new Date(reserva.checkOutDate).toLocaleDateString()}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6} {...({} as any)}>

                                            <Typography><strong>Quarto:</strong> {reserva.room.roomNumber}</Typography>
                                            <Typography><strong>Status:</strong> {reserva.room.status}</Typography>
                                            <Typography><strong>Categoria:</strong> {reserva.room.categoryName} - R$ {reserva.room.categoryPrice.toFixed(2)}</Typography>
                                        </Grid>
                                    </Grid>

                                    {/* Hóspedes */}
                                    <Box>
                                        <Typography variant="body1" className="font-semibold text-gray-700">
                                            Hóspedes
                                        </Typography>
                                        <Divider className="my-1" />
                                        {reserva.guests.length === 0 ? (
                                            <Typography className="text-gray-500 italic">Nenhum hóspede.</Typography>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                                {reserva.guests.map((hospede) => (
                                                    <Box
                                                        key={hospede.id}
                                                        className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                                                    >
                                                        <Typography><strong>Nome:</strong> {hospede.name}</Typography>
                                                        <Typography><strong>Idade:</strong> {hospede.age}</Typography>
                                                        <Typography><strong>Regra:</strong> {hospede.pricingRuleDescription}</Typography>
                                                        <Typography><strong>Valor:</strong> R$ {hospede.pricingRulePrice.toFixed(2)}</Typography>
                                                    </Box>
                                                ))}
                                            </div>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
