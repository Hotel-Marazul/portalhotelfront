import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';
import { Reservation } from '@/utils/models';

interface ReservationsProps {
  reservations: Reservation[];
  handleNewReservationOpen: () => void;
}

const Reservations: React.FC<ReservationsProps> = ({ reservations, handleNewReservationOpen }) => {
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Reservas
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewReservationOpen}
        >
          Nova Reserva
        </Button>
      </Box>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ p: 2, display: 'flex' }}>
          <TextField
            variant="outlined"
            placeholder="Buscar reservas..."
            size="small"
            sx={{ mr: 2, width: 300 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
            }}
          />
          <FormControl size="small" sx={{ width: 150, mr: 2 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" defaultValue="todos">
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="confirmada">Confirmada</MenuItem>
              <MenuItem value="pendente">Pendente</MenuItem>
              <MenuItem value="cancelada">Cancelada</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ width: 150 }}>
            <InputLabel>Pagamento</InputLabel>
            <Select label="Pagamento" defaultValue="todos">
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="pago">Pago</MenuItem>
              <MenuItem value="pendente">Pendente</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Hóspede</TableCell>
                <TableCell>Quarto</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Check-in</TableCell>
                <TableCell>Check-out</TableCell>
                <TableCell>Hóspedes</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Pagamento</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell>{reservation.id}</TableCell>
                  <TableCell>{reservation.guestName}</TableCell>
                  <TableCell>{reservation.roomNumber}</TableCell>
                  <TableCell>{reservation.roomType}</TableCell>
                  <TableCell>{new Date(reservation.checkIn).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(reservation.checkOut).toLocaleDateString()}</TableCell>
                  <TableCell>{reservation.guests}</TableCell>
                  <TableCell>{reservation.status}</TableCell>
                  <TableCell>{reservation.payment}</TableCell>
                  <TableCell align="right">R$ {reservation.totalAmount.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined">Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
};

export default Reservations;