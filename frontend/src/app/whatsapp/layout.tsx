import type { ReactNode } from "react";
import WhatsappSubnav from "../../components/whatsapp/WhatsappSubnav";

export default function WhatsappLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WhatsappSubnav />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
