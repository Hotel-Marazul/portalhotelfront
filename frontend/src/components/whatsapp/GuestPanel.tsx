import type { ConversationDetail } from "../../types/whatsapp";
import Button from "../ui/Button";

interface GuestPanelProps {
  detail: ConversationDetail;
  onCreateGuest: () => void;
  onLinkGuest: () => void;
  onNewReservation: () => void;
}

// Cadastro do contato e as ações que partem da conversa: cadastrar, vincular e reservar.
export default function GuestPanel({ detail, onCreateGuest, onLinkGuest, onNewReservation }: GuestPanelProps) {
  const reading = detail.reading;
  const hasDates = Boolean(reading?.checkIn && reading?.checkOut);

  if (detail.guest) {
    return (
      <section aria-labelledby="hospede-titulo" className="flex flex-col gap-2 border-t border-rule pt-3.5">
        <h2 id="hospede-titulo" className="m-0 text-[13px] font-semibold text-fg-2">Hóspede</h2>
        <span className="flex flex-col">
          <strong className="font-semibold">{detail.guest.fullName}</strong>
          <span className="text-xs text-fg-3">
            CPF <span className="font-mono">{detail.guest.maskedCpf}</span> · {detail.guest.stays} {detail.guest.stays === 1 ? "estadia" : "estadias"}
          </span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="primary" onClick={onNewReservation}>
            {hasDates ? "Criar reserva com estes dados" : "Nova reserva"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="hospede-titulo" className="flex flex-col gap-2 border-t border-rule pt-3.5">
      <h2 id="hospede-titulo" className="m-0 text-[13px] font-semibold text-fg-2">Contato sem cadastro</h2>
      <span className="flex flex-col">
        <strong className="font-semibold">{detail.contact.pushName || detail.contact.phone}</strong>
        <span className="text-xs text-fg-3">{detail.contact.pushName ? "Nome que aparece no WhatsApp" : "Sem nome no WhatsApp"}</span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="primary" onClick={onCreateGuest}>Cadastrar hóspede</Button>
        <Button size="sm" variant="outline" onClick={onLinkGuest}>Vincular existente</Button>
      </div>
      {hasDates && <span className="text-xs text-warn-fg">Cadastre ou vincule o contato para criar a reserva com as datas da conversa.</span>}
    </section>
  );
}
