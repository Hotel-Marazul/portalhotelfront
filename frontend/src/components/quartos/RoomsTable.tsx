"use client";

import { formatCurrency } from "../../utils/format";
import type { Room } from "../../utils/models";
import { cx } from "../ui/cx";
import { roomLabel, type RoomToday } from "./rooms-data";
import RoomSwatch from "./RoomSwatch";

export interface RoomRow {
  room: Room;
  state: RoomToday | null;
}

interface RoomsTableProps {
  rows: RoomRow[];
  /** "loading" e "error" da situação de hoje; a lista de quartos já carregou. */
  todayStatus: "loading" | "error" | "ready";
  selectedId: string | null;
  onSelect: (room: Room) => void;
}

const thClass = "sticky top-0 z-[1] bg-surface py-2 text-left text-xs font-medium text-fg-3";

export default function RoomsTable({ rows, todayStatus, selectedId, onSelect }: RoomsTableProps) {
  if (rows.length === 0) return <p className="m-0 py-6 text-[13px] text-fg-3">Nenhum quarto encontrado.</p>;

  return (
    <table className="w-full min-w-[520px] border-collapse">
      <thead>
        <tr>
          <th scope="col" className={thClass}>Quarto</th>
          <th scope="col" className={thClass}>Categoria</th>
          <th scope="col" className={cx(thClass, "pr-6 text-right")}>Diária</th>
          <th scope="col" className={thClass}>Agora</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ room, state }) => {
          const selected = room.id === selectedId;
          return (
            <tr
              key={room.id}
              onClick={() => onSelect(room)}
              className={cx("cursor-pointer border-t border-rule hover:bg-bg", selected && "bg-accent-50 hover:bg-accent-50")}
            >
              <td className="py-2">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Quarto ${roomLabel(room)}`}
                  onClick={(event) => { event.stopPropagation(); onSelect(room); }}
                  className="flex flex-col rounded-bar text-left text-fg"
                >
                  <span className="font-mono text-sm font-medium">{roomLabel(room)}</span>
                  {room.connectedRoomNumber ? <span className="text-xs text-fg-3">Conjugado</span> : null}
                </button>
              </td>
              <td className="py-2">
                <span className="flex flex-col">
                  <span>{room.type}</span>
                  <span className="text-xs text-fg-3">até {room.capacity} {room.capacity === 1 ? "pessoa" : "pessoas"}</span>
                </span>
              </td>
              <td className="py-2 pr-6 text-right font-mono text-[13px]">{formatCurrency(room.price)}</td>
              <td className="py-2">
                {state ? (
                  <span className="flex flex-col">
                    <span className="inline-flex items-center gap-1.5"><RoomSwatch kind={state.kind} />{state.label}</span>
                    {state.detail && <span className="pl-3.5 text-xs text-fg-3">{state.detail}</span>}
                  </span>
                ) : todayStatus === "loading" ? (
                  <span aria-hidden="true" className="block h-4 w-24 animate-pulse rounded-bar bg-muted" />
                ) : (
                  <span className="text-[13px] text-fg-3">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
