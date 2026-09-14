"use client";

import { FiCalendar, FiList } from "react-icons/fi";

export type ReservationWorkspaceView = "agenda" | "lista";

interface Props {
  value: ReservationWorkspaceView;
  onChange: (value: ReservationWorkspaceView) => void;
}

export default function ReservationWorkspaceSwitcher({ value, onChange }: Props) {
  return (
    <div className="workspace-switcher" role="tablist" aria-label="Visões da agenda">
      <button
        type="button"
        role="tab"
        aria-selected={value === "agenda"}
        className={value === "agenda" ? "active" : undefined}
        onClick={() => onChange("agenda")}
      >
        <FiCalendar aria-hidden="true" size={18} />
        Agenda
        <small>Ocupação por quarto</small>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "lista"}
        className={value === "lista" ? "active" : undefined}
        onClick={() => onChange("lista")}
      >
        <FiList aria-hidden="true" size={18} />
        Lista
        <small>Busca e administração</small>
      </button>
    </div>
  );
}
