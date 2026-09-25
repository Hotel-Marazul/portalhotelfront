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
      <section className={styles.detailSection} aria-labelledby="guest-panel-title">
        <h3 id="guest-panel-title">Hóspede</h3>
        <p>
          <strong>{detail.guest.fullName}</strong><br />
          CPF {detail.guest.maskedCpf}<br />
          {detail.guest.stays} estadias concluídas
        </p>
        <button type="button" className={styles.detailAction} onClick={onNewReservation}>
          Nova reserva
        </button>
      </section>
    );
  }

  return (
    <section className={styles.detailSection} aria-labelledby="guest-panel-title">
      <h3 id="guest-panel-title">Contato</h3>
      <p>{detail.contact.pushName || detail.contact.phone}</p>
      <div className={styles.detailActions}>
        <button type="button" className={styles.detailAction} onClick={onCreateGuest}>
          Cadastrar hóspede
        </button>
        <button type="button" className={styles.detailActionSecondary} onClick={onLinkGuest}>
          Vincular hóspede
        </button>
      </div>
    </section>
  );
}
