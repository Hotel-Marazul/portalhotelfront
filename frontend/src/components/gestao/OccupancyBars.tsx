import { cx } from "../ui/cx";
import { formatRate, type OccupancyBar } from "./gestao-data";

// Ocupação mensal de counter-summary.taxaOcupacaoMes: noites ocupadas sobre quartos fora de manutenção × dias do mês.
export default function OccupancyBars({ status, bars }: { status: "loading" | "error" | "ready"; bars: OccupancyBar[] }) {
  return (
    <section aria-labelledby="ocupacao-meses" className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="ocupacao-meses" className="m-0 text-[15px] font-semibold">Ocupação por mês</h2>
        <span className="text-[13px] text-fg-3">Noites ocupadas sobre quartos em operação</span>
      </div>

      {status === "loading" && (
        <span aria-busy="true" className="block h-48 animate-pulse rounded-block bg-muted min-[900px]:h-auto min-[900px]:flex-1">
          <span className="sr-only">Carregando</span>
        </span>
      )}
      {status === "error" && <p role="alert" className="m-0 text-[13px] text-danger">Não foi possível carregar a ocupação.</p>}
      {status === "ready" && bars.length === 0 && <p className="m-0 text-[13px] text-fg-3">Sem dados de ocupação.</p>}
      {status === "ready" && bars.length > 0 && (
        <div className="flex h-56 min-h-40 min-[900px]:h-auto min-[900px]:flex-1">
          <ol className="m-0 grid flex-1 list-none gap-3 p-0 min-[900px]:gap-6" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
            {bars.map((bar) => (
              <li
                key={bar.label}
                aria-label={`${bar.label}${bar.current ? ", mês atual" : ""}: ${formatRate(bar.rate)} de ocupação, ${bar.roomNights} noites`}
                title={`${bar.label} · ${formatRate(bar.rate)} · ${bar.roomNights} noites`}
                className="relative flex min-w-0 flex-col"
              >
                <div className="relative flex flex-1 flex-col justify-end border-b border-rule pt-6">
                  <span
                    className={cx("relative mx-auto w-full max-w-16 rounded-t-bar", bar.current ? "bg-accent" : "bg-accent-200")}
                    style={{ height: `${bar.height}%` }}
                  >
                    <span className={cx("absolute inset-x-0 -top-5 text-center font-mono text-xs", bar.current ? "font-medium text-fg" : "text-fg-2")}>
                      {formatRate(bar.rate)}
                    </span>
                  </span>
                </div>
                <span className={cx("pt-2 text-center text-[13px]", bar.current ? "font-medium text-fg" : "text-fg-3")}>{bar.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
