"use client";

import React from "react";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiBookOpen, FiGrid, FiHome, FiLogOut, FiMessageCircle } from "react-icons/fi";
import { MdOutlineCategory } from "react-icons/md";
import { LuBed } from "react-icons/lu";
import apiClient from "../services/api";

const routes = [
  { key: "dashboard", path: "/dashboard", label: "Dashboard", icon: <FiHome size={20} /> },
  { key: "quartos", path: "/quarto", label: "Quartos", icon: <LuBed size={23} /> },
  { key: "reservations", path: "/reservas", label: "Reservas", icon: <FiBookOpen size={20} /> },
  { key: "clientes", path: "/cliente", label: "Hospedes", icon: <FiGrid size={20} /> },
  { key: "categorias", path: "/categoria", label: "Categorias", icon: <MdOutlineCategory size={23} /> },
  { key: "agente", path: "/agente", label: "Agente IA", icon: <FiMessageCircle size={20} /> }
];

export default function Sidenav() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiClient.post("/api/User/logout");
    } catch {
      // Redirect anyway to avoid client-side stale auth state.
    } finally {
      router.replace("/login");
    }
  }

  return (
    <aside className="fixed top-0 left-0 z-50 flex h-full w-48 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-6 text-xl font-semibold tracking-tight text-black">Portal Hotel</div>
      <List className="flex-1">
        {routes.map(({ key, path, label, icon }) => (
          <ListItem key={key} className="p-0">
            <Link
              href={path}
              className="flex w-full items-center gap-3 rounded px-6 py-3 text-black no-underline transition-colors hover:bg-gray-100"
            >
              <span className="text-gray-500">{icon}</span>
              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  className: "m-0 text-base font-normal text-black"
                }}
              />
            </Link>
          </ListItem>
        ))}
      </List>
      <div className="border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
        >
          <FiLogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
