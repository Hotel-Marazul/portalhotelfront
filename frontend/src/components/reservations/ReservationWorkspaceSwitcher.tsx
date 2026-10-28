"use client";

import Segmented from "../ui/Segmented";

export type ReservationWorkspaceView = "agenda" | "lista";

interface Props {
  value: ReservationWorkspaceView;
  onChange: (value: ReservationWorkspaceView) => void;
}

export default function ReservationWorkspaceSwitcher({ value, onChange }: Props) {
  return (
    <Segmented
      label="Visão da agenda"
      value={value}
      onChange={onChange}
      options={[
        { value: "agenda", label: "Mapa" },
        { value: "lista", label: "Lista" },
      ]}
    />
  );
}
