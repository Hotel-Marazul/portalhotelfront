import { FiBookOpen, FiGrid, FiHome, FiMessageCircle } from "react-icons/fi";
import { MdOutlineCategory } from "react-icons/md";
import { LuBed } from "react-icons/lu";

export type UserRole = "admin" | "receptionist";

export interface NavItem {
  key: string;
  path: string;
  label: string;
  /** Sem `roles`, o item aparece para todos os papéis. */
  roles?: UserRole[];
}

// Ordem do menu do desenho. Gestão só para o gerente, no topo.
export const NAV_ITEMS: NavItem[] = [
  { key: "gestao", path: "/gestao", label: "Gestão", roles: ["admin"] },
  { key: "dashboard", path: "/dashboard", label: "Hoje" },
  { key: "reservas", path: "/reservas", label: "Agenda" },
  { key: "hospedes", path: "/cliente", label: "Hóspedes" },
  { key: "quartos", path: "/quarto", label: "Quartos" },
  { key: "categorias", path: "/categoria", label: "Tarifas" },
  { key: "whatsapp", path: "/whatsapp", label: "WhatsApp" },
];

export function navItemsFor(role: UserRole | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));
}

/** Primeira tela depois do login: o gerente entra pela Gestão. */
export function homePathFor(role: string | null | undefined): string {
  return role === "admin" ? "/gestao" : "/dashboard";
}

// Telas com a barra de busca do topo e o atalho Ctrl/⌘ K.
export const COMMAND_BAR_PATHS = ["/dashboard", "/gestao", "/reservas", "/cliente", "/quarto"];

export const APP_ROUTES = {
  home: "/dashboard",
  login: "/login",
  dashboard: "/dashboard",
  gestao: "/gestao",
  reservas: "/reservas",
  quartos: "/quarto",
  hospedes: "/cliente",
  categorias: "/categoria",
  whatsapp: "/whatsapp",
} as const;

// Menu antigo (sidenav.tsx e header.tsx); sai no próximo commit.
export const NAV_WIDTH = 224;
export const HEADER_HEIGHT = 64;

export const APP_SECTIONS = [
  {
    label: "Operação",
    items: [
      { key: "dashboard", path: "/dashboard", label: "Hoje", Icon: FiHome, size: 17 },
      { key: "reservas", path: "/reservas", label: "Agenda", Icon: FiBookOpen, size: 17 },
      { key: "whatsapp", path: "/whatsapp", label: "WhatsApp", Icon: FiMessageCircle, size: 17 },
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
] as const;

export const APP_PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Hoje",
  "/quarto": "Quartos",
  "/categoria": "Categorias",
  "/reservas": "Agenda",
  "/cliente": "Hóspedes",
  "/whatsapp": "WhatsApp",
  "/whatsapp/aprendizado": "Aprendizado da IA",
  "/whatsapp/configuracoes": "Configurações do WhatsApp",
  "/login": "Portal Hotel",
};
