"use client";

import { useState, useEffect } from "react";
import { MenuItem, Select, TextField } from "@mui/material";
import { VscFilter } from "react-icons/vsc";
import { KeyboardArrowDown } from "@mui/icons-material";
import { FaMagnifyingGlass } from "react-icons/fa6";

interface FiltroQuartosProps {
  status: string;
  setStatus: (s: string) => void;
  busca: string;
  setBusca: (b: string) => void;
}

export default function FiltroQuartos({ status, setStatus, busca, setBusca }: FiltroQuartosProps) {

  const [statusInterno] = useState("Todos"); 

  useEffect(() => {
    setStatus(statusInterno);
  }, [statusInterno]);

  return (
    <div className="flex flex-col md:flex-row gap-2 items-center">
      
      <div className="flex items-center gap-1">
        <VscFilter size={20} className="text-gray-600" />
        <span className="text-gray-700 text-lg font-bold mx-3 pt-[4px]">Status:</span>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          displayEmpty
          variant="outlined"
          className="w-50 h-9 bg-gray-100 rounded-lg mt-[4px]"
          IconComponent={KeyboardArrowDown}
          sx={{
            "& .MuiOutlinedInput-notchedOutline": {
              border: "none", 
            },
            borderRadius: "0.8rem",
          }}
        
          MenuProps={{
            PaperProps: {
              sx: {
                borderRadius: "0.5rem",
                mt: 1,
                "& .MuiMenuItem-root": {
                  borderRadius: "0.5rem",
                  mx: 1,
                  my: 0.5,
                  position: "relative",
                },
                "& .Mui-selected": {
                  fontWeight: "bold",
                  backgroundColor: "#f3f3f5",
                  position: "relative",
                  "&::after": {
                    content: "'✔'",
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                  },
                },
                "& .MuiMenuItem-root:hover": {
                  backgroundColor: "#e5e7eb",
                },
              },
            },
          }}
        >
          <MenuItem value="Todos" className="text-gray-400">Todos</MenuItem>
          <MenuItem value="Livre">Livre</MenuItem>
          <MenuItem value="Ocupado">Ocupado</MenuItem>
          <MenuItem value="Manutenção">Manutenção</MenuItem>
        </Select>
      </div>

      <div className="flex gap-2 ml-1 items-center w-full md:w-auto mt-2 md:mt-0">
      <FaMagnifyingGlass size={18} className="ml-3 mr-1 text-gray-400" />
      <TextField
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por número ou tipo..."
        className="w-90 bg-gray-100 rounded-lg mt-[4px]"
        sx={{
          marginTop: "4px",
          "& .MuiOutlinedInput-root": {
            height: "36px", 
            borderRadius: "0.5rem", 
            backgroundColor: "#f3f4f6", 
            "& fieldset": { border: "none" }, 
            fontSize: "0.9rem", 
            "&.Mui-focused": {
              borderWidth: "2px", 
              borderColor: "rgba(107, 114, 128, 0.3)", 
              boxShadow: "0 0 0 2px rgba(107, 114, 128, 0.3)", 
            },
          },
        }}
      />
      </div>
    </div>
  );
}
