"use client";

import { TextField } from "@mui/material";
import { FaMagnifyingGlass } from "react-icons/fa6";

interface FiltroCategoriasProps {
  busca: string;
  setBusca: (b: string) => void;
}

export default function FiltroCategorias({ busca, setBusca }: FiltroCategoriasProps) {

  return (
    <div className="flex flex-col md:flex-row gap-2 items-center">

      <div className="flex gap-2 ml-1 items-center w-full md:w-auto mt-2 md:mt-0">
      <FaMagnifyingGlass size={18} className="ml-3 mr-1 text-gray-400" />
      <TextField
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por tipo..."
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
