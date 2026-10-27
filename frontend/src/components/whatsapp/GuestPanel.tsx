import type { ConversationDetail } from "../../types/whatsapp";
import styles from "./whatsapp.module.css";

interface GuestPanelProps {
  detail: ConversationDetail;
  onCreateGuest: () => void;
  onLinkGuest: () => void;
  onNewReservation: () => void;
}

export default function GuestPanel({ detail, onCreateGuest, onLinkGuest, onNewReservation }: GuestPanelProps) {
  if (detail.guest) {
    return (
      <section className={styles.guestCard} aria-labelledby="guest-panel-title">
        <h3 id="guest-panel-title">Hóspede</h3>
        <strong>{detail.guest.fullName}</strong>
        <p>CPF {detail.guest.maskedCpf} · {detail.guest.stays} {detail.guest.stays === 1 ? "estadia" : "estadias"}</p>
        <div className={styles.detailActions}>
          <button type="button" className={styles.detailAction} onClick={onNewReservation}>
            Nova reserva
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.guestCard} aria-labelledby="guest-panel-title">
      <h3 id="guest-panel-title">Contato sem cadastro</h3>
      <strong>{detail.contact.pushName || detail.contact.phone}</strong>
      <div className={styles.detailActions}>
        <button type="button" className={styles.detailAction} onClick={onCreateGuest}>
          Cadastrar hóspede
        </button>
        <button type="button" className={styles.detailActionSecondary} onClick={onLinkGuest}>
          Vincular existente
        </button>
      </div>
    </section>
  );
}
