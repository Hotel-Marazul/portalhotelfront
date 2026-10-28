import type { RoomTodayKind } from "./rooms-data";
import { cx } from "../ui/cx";

// Mesma lógica de luminosidade da Agenda: escuro hospedado, destaque chegada, contorno livre, listras manutenção.
const SWATCHES: Record<RoomTodayKind, string> = {
  staying: "bg-fg",
  leaving: "bg-fg",
  arriving: "bg-accent",
  awaiting: "bg-warn-bg shadow-[inset_0_0_0_1px_var(--warn-border)]",
  free: "bg-surface shadow-[inset_0_0_0_1.5px_var(--accent-300)]",
  maintenance: "hatch shadow-[inset_0_0_0_1px_var(--hatch-a)]",
};

export default function RoomSwatch({ kind, className }: { kind: RoomTodayKind | null; className?: string }) {
  return <span aria-hidden="true" className={cx("inline-block size-2 shrink-0 rounded-[2px]", kind ? SWATCHES[kind] : "bg-muted", className)} />;
}
