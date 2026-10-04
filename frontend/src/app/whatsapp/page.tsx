import WhatsappWorkspace from "../../components/whatsapp/WhatsappWorkspace";
import styles from "../../components/whatsapp/whatsapp.module.css";

export default function WhatsappPage() {
  return (
    <div className={styles.page}>
      <h1 className="sr-only">Central do WhatsApp</h1>
      <WhatsappWorkspace />
    </div>
  );
}
