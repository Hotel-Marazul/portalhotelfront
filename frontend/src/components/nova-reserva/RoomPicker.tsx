"use client";

import { formatCurrency } from "../../utils/format";
import Button from "../ui/Button";
import { cx } from "../ui/cx";
import { roomLabel, type RoomGroup } from "./nova-reserva-data";

interface RoomPickerProps {
  groups: RoomGroup[];
  excludedMessage: string;
  selectedId: string;
  onSelect: (roomId: string) => void;
  status: "idle" | "loading" | "error" | "ready";
  error: string | null;
  onRetry: () => void;
  checkedAt: Date | null;
  disabled?: boolean;
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Quartos livres agrupados por categoria, com a diária de casal da categoria.
export default function RoomPicker({ groups, excludedMessage, selectedId, onSelect, status, error, onRetry, checkedAt, disabled }: RoomPickerProps) {
  if (status === "idle") return <p className="m-0 text-[13px] text-fg-3">Informe entrada e saída para ver os quartos livres.</p>;
  if (status === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        <span className="sr-only">Consultando quartos disponíveis</span>
        {[0, 1, 2].map((row) => <span key={row} aria-hidden="true" className="h-10 animate-pulse rounded-bar bg-muted" />)}
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p role="alert" className="m-0 text-[13px] text-danger">{error}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.length === 0 ? (
        <p className="m-0 text-[13px] text-fg-2">Nenhum quarto livre comporta o grupo nessas datas.</p>
      ) : (
        <div className="flex flex-col">
          {groups.map((group) => (
            <div key={group.key} className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-rule py-2 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
              <span className="flex flex-col">
                <span className="text-sm font-medium">{group.name}</span>
                <span className="text-xs text-fg-3">
                  <span className="font-mono">{group.rooms.length}</span> {group.rooms.length === 1 ? "livre" : "livres"}
                </span>
              </span>
              <span role="radiogroup" aria-label={`Quartos ${group.name}`} className="col-span-2 row-start-2 flex flex-wrap gap-1.5 sm:col-span-1 sm:row-start-auto">
                {group.rooms.map((room) => {
                  const active = room.id === selectedId;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`Quarto ${roomLabel(room)}, até ${room.capacity} pessoas`}
                      disabled={disabled}
                      onClick={() => onSelect(room.id)}
                      className={cx(
                        "h-8 min-w-[52px] rounded-control px-2.5 font-mono text-[13px] transition-colors",
                        active ? "bg-fg text-on-dark" : "border border-border bg-surface text-fg hover:bg-bg",
                      )}
                    >
                      {roomLabel(room)}
                    </button>
                  );
                })}
              </span>
              <span className="col-start-2 row-start-1 text-right text-[13px] text-fg-2 sm:col-start-3">
                {group.couplePrice !== null ? <><span className="font-mono text-fg">{formatCurrency(group.couplePrice)}</span> casal</> : null}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="m-0 text-xs text-fg-3">
        {excludedMessage && <>{excludedMessage} </>}
        {checkedAt && <>Disponibilidade conferida às <span className="font-mono">{timeFormat.format(checkedAt)}</span> e checada de novo ao criar.</>}
      </p>
    </div>
  );
}
