import Link from "next/link";
import WhatsappWorkspace from "../../components/whatsapp/WhatsappWorkspace";
import styles from "../../components/whatsapp/whatsapp.module.css";

export default function WhatsappPage() {
  return (
    <div className={`page-content ${styles.page}`}>
      <header className="page-header">
        <div>
          <h1>Central do WhatsApp</h1>
          <p>Priorize as conversas e responda pelo número do hotel.</p>
        </div>
        <Link href="/whatsapp/aprendizado">Aprendizado da IA</Link>
      </header>
      <WhatsappWorkspace />
    </div>
  );
}
