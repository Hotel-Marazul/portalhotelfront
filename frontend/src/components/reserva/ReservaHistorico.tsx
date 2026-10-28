import type { ReservationDto } from "../../types/reservations";
import { formatDateTime } from "../../utils/format";
import { auditEntry } from "./reserva-data";

// O backend guarda só a última alteração no detalhe da reserva; o histórico completo não aparece.
export default function ReservaHistorico({ audit, loading }: { audit: ReservationDto["audit"]; loading: boolean }) {
  if (loading) return <span aria-busy="true" className="block h-12 animate-pulse rounded-bar bg-muted"><span className="sr-only">Carregando</span></span>;
  const entry = auditEntry(audit);
  if (!entry) return <p className="m-0 py-4 text-[13px] text-fg-3">Nenhuma alteração registrada.</p>;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="m-0 text-[13px] font-semibold text-fg-2">Última alteração</h3>
      <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 border-b border-rule py-2.5 text-[13px] max-[480px]:grid-cols-1 max-[480px]:gap-1">
        <span className="font-mono text-xs text-fg-3">{entry.occurredAt ? formatDateTime(entry.occurredAt) : "—"}</span>
        <span className="flex flex-col">
          <span>{entry.text}</span>
          {entry.actor && <span className="text-xs text-fg-3">{entry.actor}</span>}
        </span>
      </div>
    </div>
  );
}
