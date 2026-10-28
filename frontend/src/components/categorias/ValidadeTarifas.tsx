import { Info } from "lucide-react";
import { cx } from "../ui/cx";
import { outOfSeasonNotice, periodLabel, seasonName, validityBand, type BandSegmentKind, type ValidityPeriod } from "./tarifas-data";

interface ValidadeTarifasProps {
  periods: ValidityPeriod[];
  /** "AAAA-MM-DD" no fuso do hotel. */
  today: string;
  /** Total de categorias: o nome só aparece quando há mais de uma validade ou nem todas têm. */
  categoryCount: number;
}

const SEGMENT_CLASS: Record<BandSegmentKind, string> = {
  past: "bg-muted",
  gap: "bg-[repeating-linear-gradient(135deg,var(--warn-border)_0_3px,var(--surface)_3px_7px)]",
  valid: "bg-accent text-on-dark",
  after: "bg-muted",
};

function Band({ period, today, showNames }: { period: ValidityPeriod; today: string; showNames: boolean }) {
  const band = validityBand(period, today);
  const name = seasonName(period);
  const label = [name, periodLabel(period)].filter(Boolean).join(" · ");
  const notice = outOfSeasonNotice(period, today);

  return (
    <div className="flex flex-col gap-2.5">
      {showNames && <span className="text-[13px] font-medium text-fg-2">{period.categories.join(", ")}</span>}
      <div aria-hidden="true" className="relative h-4 text-[11px] text-fg-3">
        {band.months.map((month) => (
          <span key={month.key} className="absolute top-0" style={{ left: `${month.left}%`, width: `${month.width}%` }}>{month.label}</span>
        ))}
      </div>
      <div role="img" aria-label={`Tarifa vale ${label}. Hoje está marcado na faixa.`} className="relative h-[34px]">
        <div className="absolute inset-0 overflow-hidden rounded-bar">
          {band.segments.map((segment) => (
            <span
              key={segment.kind}
              className={cx("absolute inset-y-0 flex items-center overflow-hidden border-x border-surface px-2.5 text-xs font-medium whitespace-nowrap", SEGMENT_CLASS[segment.kind])}
              style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
            >
              {segment.kind === "valid" ? label : null}
            </span>
          ))}
        </div>
        <span aria-hidden="true" className="absolute -top-1 -bottom-1 border-l-2 border-fg" style={{ left: `${band.today}%` }} />
        <span aria-hidden="true" className="absolute top-[38px] -translate-x-1/2 font-mono text-[11px] text-fg" style={{ left: `${band.today}%` }}>hoje</span>
      </div>
      {notice && (
        <p className="m-0 mt-3.5 flex gap-2 text-[13px] leading-[1.45] text-fg-2">
          <Info aria-hidden="true" className="mt-px size-4 shrink-0" />
          {notice}
        </p>
      )}
    </div>
  );
}

// Validade das tarifas (rate_valid_from/until) numa faixa de meses, com hoje marcado.
export default function ValidadeTarifas({ periods, today, categoryCount }: ValidadeTarifasProps) {
  const covered = periods.reduce((sum, period) => sum + period.categories.length, 0);
  const showNames = periods.length > 1 || covered < categoryCount;

  return (
    <section aria-labelledby="validade" className="flex flex-col gap-2.5">
      <h2 id="validade" className="m-0 text-[15px] font-semibold">Validade</h2>
      {periods.length === 0 && <p className="m-0 text-[13px] text-fg-3">Nenhuma categoria tem validade cadastrada: as tarifas valem o ano todo.</p>}
      <div className="flex flex-col gap-8">
        {periods.map((period) => <Band key={`${period.from}|${period.until}`} period={period} today={today} showNames={showNames} />)}
      </div>
    </section>
  );
}
