import { FiBookOpen, FiGrid, FiHome, FiMessageCircle } from "react-icons/fi";
import { MdOutlineCategory } from "react-icons/md";
import { LuBed } from "react-icons/lu";

export const NAV_WIDTH = 224;
export const HEADER_HEIGHT = 64;

export const APP_SECTIONS = [
  {
    label: "Operação",
    items: [
      { key: "dashboard", path: "/dashboard", label: "Hoje", Icon: FiHome, size: 17 },
      { key: "reservas", path: "/reservas", label: "Agenda", Icon: FiBookOpen, size: 17 },
    ],
  },
  {
    label: "Configuração",
    items: [
      { key: "quartos", path: "/quarto", label: "Quartos", Icon: LuBed, size: 19 },
      { key: "hospedes", path: "/cliente", label: "Hóspedes", Icon: FiGrid, size: 17 },
      { key: "categorias", path: "/categoria", label: "Categorias", Icon: MdOutlineCategory, size: 19 },
    ],
  },
  {
    label: "Assistência",
    items: [
      { key: "agente", path: "/agente", label: "Agente IA", Icon: FiMessageCircle, size: 17 },
    ],
  },
] as const;

export const APP_PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Hoje",
  "/quarto": "Quartos",
  "/categoria": "Categorias",
  "/reservas": "Agenda",
  "/cliente": "Hóspedes",
  "/agente": "Agente IA",
  "/login": "Portal Hotel",
};

export const APP_ROUTES = {
  home: "/dashboard",
  login: "/login",
  dashboard: "/dashboard",
  reservas: "/reservas",
  quartos: "/quarto",
  hospedes: "/cliente",
  categorias: "/categoria",
  agente: "/agente",
} as const;
