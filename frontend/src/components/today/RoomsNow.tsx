import Link from "next/link";

export interface RoomSummary {
  ocupados: number;
  disponiveis: number;
  manutencao: number;
}

const SEGMENTS: Array<{ key: keyof RoomSummary; label: string; swatch: string }> = [
  { key: "disponiveis", label: "Livres", swatch: "bg-accent" },
  { key: "ocupados", label: "Ocupados", swatch: "bg-hatch-a" },
  { key: "manutencao", label: "Manutenção", swatch: "hatch shadow-[inset_0_0_0_1px_var(--hatch-a)]" },
];

// Ocupação dos quartos hoje, de /api/rooms/summary. Limpeza por quarto fica para add-room-housekeeping-status.
export default function RoomsNow({ status, summary }: { status: "loading" | "error" | "ready"; summary: RoomSummary | null }) {
  const total = summary ? summary.ocupados + summary.disponiveis + summary.manutencao : 0;
  const description = summary
    ? `${total} quartos: ${summary.disponiveis} livres, ${summary.ocupados} ocupados, ${summary.manutencao} em manutenção`
    : "";

  return (
    <section aria-labelledby="quartos-agora" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="quartos-agora" className="m-0 text-[15px] font-semibold">Quartos agora</h2>
        <Link href="/reservas" className="text-[13px] text-fg-2 underline-offset-4 hover:text-fg">Ver mapa</Link>
      </div>
      {status === "loading" && <span aria-busy="true" className="block h-[52px] animate-pulse rounded-bar bg-muted"><span className="sr-only">Carregando</span></span>}
      {status === "error" && <p role="alert" className="m-0 text-[13px] text-danger">Não foi possível carregar os quartos.</p>}
      {status === "ready" && summary && (
        <>
          <div role="img" aria-label={description} className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {total > 0 && SEGMENTS.map((segment) => summary[segment.key] > 0 && (
              <span key={segment.key} className={segment.swatch} style={{ flex: summary[segment.key] }} />
            ))}
          </div>
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {SEGMENTS.map((segment) => (
              <div key={segment.key} className="flex items-center gap-2">
                <span aria-hidden="true" className={`size-2 rounded-[2px] ${segment.swatch}`} />
                <dt className="text-fg-2">{segment.label}</dt>
                <dd className="m-0 ml-auto font-mono">{summary[segment.key]}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
