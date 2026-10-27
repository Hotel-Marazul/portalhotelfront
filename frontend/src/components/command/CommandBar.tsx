"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { BedDouble, CalendarDays, Search, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import api from "../../services/api";
import { COMMAND_BAR_PATHS } from "../../config/navigation";
import type { ReservationDto, ReservationsResponse } from "../../types/reservations";
import type { Client, Room } from "../../utils/models";
import { formatStayPeriod } from "../../utils/format";
import { ReservationStatusChip } from "../ui/StatusChip";
import { cx } from "../ui/cx";
import { ACTIVE_RESERVATION_STATUSES, isRoomNumberQuery, matchRooms, newestFirst } from "./command-search";

const PLACEHOLDER = "Buscar hóspede, reserva ou quarto";

const CommandBarContext = createContext<{ open: () => void }>({ open: () => undefined });

export function useCommandBar() {
  return useContext(CommandBarContext);
}

// Atalho Ctrl/⌘ K só nas telas de operação, como pede o spec portal-navigation.
export function CommandBarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const enabled = COMMAND_BAR_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  const value = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <CommandBarContext.Provider value={value}>
      {children}
      {enabled && <CommandDialog open={open} onOpenChange={setOpen} />}
    </CommandBarContext.Provider>
  );
}

/** O campo do topo das telas: abre a busca ao clicar. */
export function CommandBarTrigger({ className }: { className?: string }) {
  const { open } = useCommandBar();
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setShortcut("⌘K");
  }, []);

  return (
    <button
      type="button"
      onClick={open}
      aria-keyshortcuts="Control+K Meta+K"
      className={cx("flex h-12 w-full items-center gap-3 rounded-block border border-command-border bg-command-bg pr-2 pl-4 text-left transition-colors hover:border-fg-3", className)}
    >
      <Search aria-hidden="true" className="size-[17px] shrink-0 text-fg-3" />
      <span className="min-w-0 flex-1 truncate text-[15px] text-fg-3">{PLACEHOLDER}</span>
      <kbd className="rounded-bar border border-border-soft px-2 py-1 font-mono text-xs text-fg-3">{shortcut}</kbd>
    </button>
  );
}

type SearchStatus = "idle" | "loading" | "ready" | "error";

interface SearchResults {
  status: SearchStatus;
  rooms: Array<{ room: Room; reservations: ReservationDto[] }>;
  reservations: ReservationDto[];
  clients: Client[];
}

const EMPTY: SearchResults = { status: "idle", rooms: [], reservations: [], clients: [] };

function useCommandSearch(query: string): SearchResults {
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const roomsRef = useRef<Room[] | null>(null);

  useEffect(() => {
    const term = query.trim();
    const roomQuery = isRoomNumberQuery(term);
    if (!roomQuery && term.length < 2) {
      setResults(EMPTY);
      return;
    }
    let active = true;
    setResults((current) => ({ ...current, status: "loading" }));

    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (roomQuery && !roomsRef.current) roomsRef.current = (await api.get<Room[]>("/api/rooms")).data;
          const rooms = roomQuery ? matchRooms(roomsRef.current ?? [], term) : [];
          const [clientsResponse, reservationsResponse, roomReservations] = await Promise.all([
            roomQuery ? null : api.get<{ items: Client[] }>("/api/client", { params: { search: term, page: 1, limit: 5 } }),
            roomQuery ? null : api.get<ReservationsResponse>("/api/reservations", { params: { search: term, page: 1, pageSize: 8 } }),
            Promise.all(rooms.map((room) => api.get<ReservationsResponse>("/api/reservations", {
              params: { roomId: room.id, status: ACTIVE_RESERVATION_STATUSES.join(","), page: 1, pageSize: 5 },
            }))),
          ]);
          if (!active) return;
          setResults({
            status: "ready",
            clients: clientsResponse?.data.items ?? [],
            reservations: newestFirst(reservationsResponse?.data.items ?? []),
            rooms: rooms.map((room, index) => ({ room, reservations: newestFirst(roomReservations[index]?.data.items ?? []) })),
          });
        } catch {
          if (active) setResults({ ...EMPTY, status: "error" });
        }
      })();
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return results;
}

const groupClass = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3";
const itemClass = "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-sm data-[selected=true]:bg-muted";
const messageClass = "px-3 py-6 text-center text-[13px] text-fg-3";

function ReservationItem({ reservation, indent, onSelect }: { reservation: ReservationDto; indent?: boolean; onSelect: () => void }) {
  const guest = reservation.client?.fullName ?? reservation.client?.name ?? "Hóspede";
  const room = reservation.room?.displayNumber ?? reservation.room?.number;
  return (
    <Command.Item value={`reserva-${indent ? "quarto-" : ""}${reservation.id}`} onSelect={onSelect} className={cx(itemClass, indent && "pl-10")}>
      <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
      <span className="min-w-0 flex-1 truncate font-medium">{guest}</span>
      {room !== undefined && <span className="font-mono text-[13px] text-fg-2">{room}</span>}
      <span className="text-[13px] whitespace-nowrap text-fg-2">{formatStayPeriod(reservation.checkInDate, reservation.checkOutDate)}</span>
      <ReservationStatusChip status={reservation.status} />
    </Command.Item>
  );
}

function CommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const results = useCommandSearch(open ? query : "");
  const hasResults = results.rooms.length + results.reservations.length + results.clients.length > 0;

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1300] bg-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-[1300] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-panel bg-surface text-fg shadow-sheet"
        >
          <Dialog.Title className="sr-only">{PLACEHOLDER}</Dialog.Title>
          <Command shouldFilter={false} label={PLACEHOLDER} loop>
            <div className="flex items-center gap-3 border-b border-rule px-4">
              <Search aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Nome, e-mail, telefone, CPF ou número do quarto"
                className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-3"
              />
              <kbd className="rounded-bar border border-border-soft px-2 py-1 font-mono text-xs text-fg-3">Esc</kbd>
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
              {results.status === "idle" && <p className={messageClass}>Digite pelo menos 2 letras, ou o número do quarto.</p>}
              {results.status === "loading" && !hasResults && <Command.Loading><p className={messageClass}>Buscando…</p></Command.Loading>}
              {results.status === "error" && <p role="alert" className={cx(messageClass, "text-danger")}>Não foi possível buscar agora. Tente de novo.</p>}
              {results.status === "ready" && !hasResults && <p role="status" className={messageClass}>Nada encontrado para “{query.trim()}”.</p>}

              {results.rooms.length > 0 && (
                <Command.Group heading="Quartos" className={groupClass}>
                  {results.rooms.map(({ room, reservations }) => (
                    <Fragment key={room.id}>
                      <Command.Item value={`quarto-${room.id}`} onSelect={() => go(`/quarto?quarto=${room.id}`)} className={itemClass}>
                        <BedDouble aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
                        <span className="font-mono font-medium">{room.displayNumber ?? room.number}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-fg-2">{room.type} · até {room.capacity} {room.capacity === 1 ? "pessoa" : "pessoas"}</span>
                        {reservations.length === 0 && <span className="text-[13px] text-fg-3">sem reserva ativa</span>}
                      </Command.Item>
                      {reservations.map((reservation) => (
                        <ReservationItem key={reservation.id} reservation={reservation} indent onSelect={() => go(`/reservas?reserva=${reservation.id}`)} />
                      ))}
                    </Fragment>
                  ))}
                </Command.Group>
              )}

              {results.clients.length > 0 && (
                <Command.Group heading="Hóspedes" className={groupClass}>
                  {results.clients.map((client) => (
                    <Command.Item key={client.id} value={`hospede-${client.id}`} onSelect={() => go(`/cliente?cliente=${client.id}&busca=${encodeURIComponent(client.fullName)}`)} className={itemClass}>
                      <UserRound aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
                      <span className="min-w-0 flex-1 truncate font-medium">{client.fullName}</span>
                      <span className="font-mono text-[13px] text-fg-2">{client.fone || client.cpf}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {results.reservations.length > 0 && (
                <Command.Group heading="Reservas" className={groupClass}>
                  {results.reservations.map((reservation) => (
                    <ReservationItem key={reservation.id} reservation={reservation} onSelect={() => go(`/reservas?reserva=${reservation.id}`)} />
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
