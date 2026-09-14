export const WHATSAPP_RESERVATION_URL =
  "https://wa.me/5551982180262?text=" +
  encodeURIComponent("Olá! Gostaria de planejar uma estadia no Hotel Marazul. Podem me ajudar com as datas e acomodações?");

export function getRoomReservationUrl(category: string) {
  return "https://wa.me/5551982180262?text=" + encodeURIComponent(
    `Olá! Tenho interesse na acomodação ${category} do Hotel Marazul. Podemos conversar sobre datas e valores?`
  );
}

export const HOTEL_IMAGES = {
  pool: "/hotel/tratadas/piscina-v2.png",
  arrival: "/hotel/tratadas/chegada-sem-placa-v2.png",
  breakfast: "/hotel/tratadas/cafe-da-manha-sem-marca.png",
  restaurant: "/hotel/tratadas/restaurante-sem-marca.png",
};

export const LANDING_NAVIGATION = [
  { label: "O hotel", href: "#o-hotel" },
  { label: "Acomodações", href: "#acomodacoes" },
  { label: "Café da manhã", href: "#cafe-da-manha" },
  { label: "Lazer", href: "#experiencias" },
  { label: "Localização", href: "#contato" },
];

export const LANDING_GALLERY = [
  { src: HOTEL_IMAGES.pool, alt: "Piscinas do Hotel Marazul com cadeiras e guarda-sóis ao redor", title: "Um mergulho, sem pressa", caption: "Piscina e piscina infantil para aproveitar os dias de sol.", label: "Piscinas" },
  { src: "/hotel/tratadas/sala-de-jogos.png", alt: "Sala de jogos com mesas de sinuca, tênis de mesa e pebolim", title: "Só mais uma partida", caption: "Sinuca, tênis de mesa e pebolim. Quem vai jogar com você?", label: "Sala de jogos" },
  { src: "/hotel/tratadas/lobby.png", alt: "Sala de estar do Marazul com poltronas e plantas", title: "A conversa pode continuar", caption: "Um cantinho para ler, conversar ou simplesmente não fazer nada.", label: "Sala de estar" },
];

export const ACCOMMODATIONS = [
  { name: "Super Luxo", image: "/hotel/tratadas/apartamento-super-luxo.png", alt: "Apartamento Super Luxo com cama de casal e segundo ambiente", description: "Espaço para desacelerar. Dois ambientes para viver os seus dias de praia com mais conforto.", details: ["Dois ambientes", "Cama king", "Ar-condicionado"] },
  { name: "Luxo", image: "/hotel/tratadas/apartamento-luxo.png", alt: "Apartamento Luxo com cama de casal e janela", description: "Um lugar acolhedor para descansar depois de aproveitar Curumim. Abra espaço na agenda para ficar mais um pouco.", details: ["Dois ambientes", "Cama queen", "Ar-condicionado"] },
  { name: "Standard", image: "/hotel/tratadas/apartamento-standard.png", alt: "Apartamento Standard do Hotel Marazul", description: "O conforto de estar pertinho da piscina. Para quem gosta de aproveitar cada momento da estadia.", details: ["Um ambiente", "Frente piscina", "Ar-condicionado"] },
  { name: "Simples", image: "/hotel/tratadas/apartamento-simples.png", alt: "Apartamento Simples na área interna do Hotel Marazul", description: "A leveza de uma viagem descomplicada. Um espaço para recarregar as energias e acordar para um novo dia.", details: ["Um ambiente", "Área interna", "Ar-condicionado"] },
];
