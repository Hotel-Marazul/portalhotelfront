"use client";

import { Box, CircularProgress, Typography } from "@mui/material";

export default function Loading() {
  return (
    <Box className="min-h-screen flex items-center justify-center">
      <Box className="flex flex-col items-center gap-3">
        <CircularProgress size={30} />
        <Typography variant="body2" color="text.secondary">
          Carregando tela...
        </Typography>
      </Box>
    </Box>
  );
}
