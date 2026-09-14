import type { Metadata } from "next";
import HotelLanding from "../components/landing/HotelLanding";

const siteUrl = process.env.SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: "Hotel Marazul | Seu tempo de descanso em Curumim",
  description: "Conheça o Hotel Marazul em Curumim, RS. Acomodações, piscinas e momentos para aproveitar o litoral com a família. Planeje sua estadia com a nossa equipe.",
  openGraph: {
    title: "Hotel Marazul — Curumim, RS",
    description: "Dias leves. Boas lembranças. Conheça o seu próximo descanso em Curumim.",
    ...(siteUrl ? { images: [{ url: "/hotel/tratadas/piscina-v2.png", width: 1448, height: 1086, alt: "Piscinas do Hotel Marazul" }] } : {}),
    locale: "pt_BR",
    type: "website",
  },
};

export default function Home() {
  return <HotelLanding />;
}
