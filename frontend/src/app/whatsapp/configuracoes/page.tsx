import WhatsappConfiguration from "../../../components/whatsapp/WhatsappConfiguration";

export default function WhatsappConfigurationPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[22px] px-8 pt-[22px] pb-6 max-[899px]:px-4">
      <header className="flex shrink-0 flex-col gap-0.5">
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Configurações do WhatsApp</h1>
        <p className="m-0 text-sm text-fg-3">Só a gerência vê esta página. Chaves e senhas ficam no servidor e nunca chegam ao navegador.</p>
      </header>
      <WhatsappConfiguration />
    </div>
  );
}
