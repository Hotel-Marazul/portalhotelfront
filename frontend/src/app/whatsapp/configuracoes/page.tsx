import Link from "next/link";
import WhatsappConfiguration from "../../../components/whatsapp/WhatsappConfiguration";
import styles from "../../../components/whatsapp/configuration.module.css";

export default function WhatsappConfigurationPage() {
  return <div className={`page-content ${styles.page}`}>
    <header className="page-header">
      <div><h1>Configurações do WhatsApp</h1><p>Conecte o número do hotel e acompanhe a saúde do canal e do agente.</p></div>
      <Link href="/whatsapp" className={styles.backLink}>Voltar para a central</Link>
    </header>
    <WhatsappConfiguration />
  </div>;
}

