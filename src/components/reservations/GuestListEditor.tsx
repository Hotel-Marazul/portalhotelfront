import { Paper, Box, Typography, IconButton, Stack, TextField, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { Delete } from "@mui/icons-material";
import React from "react";
import { GuestForm, PricingRule } from "@/types/reservations"; // ajuste se estiver noutro arquivo

interface Props {
  guests: GuestForm[];
  onGuestChange: (index: number, field: keyof GuestForm, value: string | number | null) => void;
  onAddGuest: () => void;
  onRemoveGuest: (index: number) => void;
  pricingRules: PricingRule[];
  readonly?: boolean;
}


export default function GuestListEditor({
  guests,
  onGuestChange,
  onAddGuest,
  onRemoveGuest,
  pricingRules,
  readonly = false
}: Props) {
  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle2" fontWeight="bold">
          Hóspedes ({guests.length})
        </Typography>
        {!readonly && (
          <IconButton size="small" onClick={onAddGuest}>
            Adicionar
          </IconButton>
        )}
      </Box>
      {guests.map((guest, index) => (
        <Paper key={index} elevation={1} sx={{ p: 2, bgcolor: "#f9fafb" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="caption" fontWeight="bold">
              Hóspede {index + 1}
            </Typography>
            {!readonly && (
              <IconButton
                size="small"
                onClick={() => onRemoveGuest(index)}
                color="error"
              >
                <Delete fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Stack spacing={2}>
            <TextField
              label="Nome"
              value={guest.name}
              onChange={(e) => onGuestChange(index, "name", e.target.value)}
              disabled={readonly}
              fullWidth
              size="small"
            />
            <TextField
              label="Idade"
              type="number"
              value={guest.age || ""}
              onChange={(e) => onGuestChange(index, "age", parseInt(e.target.value) || 0)}
              disabled={readonly}
              fullWidth
              size="small"
              inputProps={{ min: 0, max: 120 }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Regra de Preço (Opcional)</InputLabel>
              <Select
                value={guest.pricingRuleId || ""}
                label="Regra de Preço (Opcional)"
                onChange={(e) => onGuestChange(index, "pricingRuleId", e.target.value || null)}
                disabled={readonly || guest.age <= 0}
              >
                <MenuItem value=""><em>Nenhuma regra de preço</em></MenuItem>
                {pricingRules.map((rule) => (
                  <MenuItem key={rule.id} value={rule.id}>
                    {rule.description} - R$ {rule.price.toFixed(2)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
