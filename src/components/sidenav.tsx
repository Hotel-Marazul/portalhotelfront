"use client";

import React from "react";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Link from "next/link";
import { FiHome, FiBookOpen, FiGrid } from "react-icons/fi";
import { LuBed } from "react-icons/lu";
import { MdOutlineCategory } from "react-icons/md";

const routes = [
  { key: "dashboard", path: "/dashboard", label: "Dashboard", icon: <FiHome size={20} /> },
  { key: "quartos", path: "/quarto", label: "Quartos", icon: <LuBed size={23} />},
  { key: "reservations", path: "/reservas", label: "Reservas", icon: <FiBookOpen size={20} /> },
  { key: "clientes", path: "/cliente", label: "Hóspedes", icon: <FiGrid size={20} /> },
  { key: "categorias", path: "/categoria", label: "Categorias", icon: <MdOutlineCategory size={23} />},
];

export default function Sidenav() {
  return (
    <aside className="fixed top-0 left-0 h-full w-48 bg-white border-r border-gray-200 z-50 flex flex-col">
      <div className="text-black text-xl font-semibold p-6 border-b border-gray-100 tracking-tight">Portal Hotel</div>
      <List className="flex-1">
        {routes.map(({ key, path, label, icon }) => (
          <ListItem key={key} className="p-0">
            <Link href={path} className="w-full flex items-center gap-3 px-6 py-3 no-underline hover:bg-gray-100 transition-colors rounded text-black">
              <span className="text-gray-500">{icon}</span>
              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  className: "text-black text-base font-normal m-0"
                }}
              />
            </Link>
          </ListItem>
        ))}
      </List>
    </aside>
  );
}