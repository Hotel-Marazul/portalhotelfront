# Especificação compilada — Hotel Marazul

Status: aprovado para implementação em 13/09/2026. O usuário respondeu “Pode seguir e implementar” ao storyboard. Este documento registra a composição e o código de referência completos antes da implementação.

## Composição fechada
Home pública apenas. Moonrise Kingdom / Wes Anderson traduzidos em abertura central, enquadramento arquitetônico da piscina, luz azul-clara, assimetria controlada no café e bloco azul-profundo para lazer. Não usar frames do filme nem nomes do processo na UI. Fotografias reais tratadas; nunca recriar instalações.

## Fontes da biblioteca e cenas
- Hero #18 Framed Viewport; composição #3 Centered Stack; câmera #7 Split Diopter / recorte. Custom: título vertical e moldura exterior adaptados para não esconder mobiliário com texto. Título, foto e moldura são os elementos da abertura.
- Hotel: composição #34 60/40; foto em moldura e legenda factual; entrada intencionalmente nenhuma.
- Quartos: função #18, arquétipo CM-3; composição #24 Horizontal Flow para seletor. Câmera #36 Lateral Tracking adaptada Custom para deslocamento discreto de 16px, sem scroll hijack.
- Café: função #37; composição #34 assimétrica; câmera #10 Curtain Wipe reduzida a recorte de 8%.
- Lazer: função #42; composição #34. Câmera #2 dissolve; troca de foto #21 Crossfade adaptada a dissolução curta sem autoplay. Custom: seletor React com estado e setas, necessário para exploração acessível das fotos reais.
- Contato: função #35 e NC-2 convite acolhedor adaptado. Painel factual estático, link de mapa sem embed e sem coleta de dados.
- Rodapé #48 / FT-3 Centered Footer / composição #3. Nenhuma entrada.
- Tipografia 6.1 Perfect Body Text e 6.8 Balanced Subheading; hero Custom Georgia de 45–94px com duas linhas, sem destacar palavras isoladas.
- Interação #12 Underline Slide Hover nos links de navegação. Custom controles nativos, estados aria-pressed e mensagem WhatsApp com quarto selecionado.
- Atmosfera Custom: superfícies sólidas paper/mist/water, fotografia real e moldura do hero #18. Sem filtros, grain, brilho ou dependência adicional: a cor das imagens e o espaço ao redor são suficientes.

## Entrance Map
Título: recorte vertical .65s. Moldura: recorte bilateral .8s.
Hotel: nenhuma. Quartos: lateral 16px .4s. Café: recorte horizontal 8% .45s. Lazer: dissolução .4s. Contato e rodapé: nenhuma.
Cinco tipos, nenhum fade-up, zero interação pesada e dois reveals chamativos. Conteúdo visível por padrão sem JavaScript; IntersectionObserver dispara uma única vez. Pausa e preferência de movimento reduzido desativam animações.

## External Library Decision
### Q1: Qual a experiência central?
Enquadramentos de fotografias, entradas curtas e navegação manual.
### Q2: As entradas nativas resolvem?
Sim. CSS, IntersectionObserver e estado local React existente.
### Q3: Por que uma biblioteca externa?
Não se aplica.
### Decision
Nenhuma biblioteca externa adicionada. Next Image e react-icons já instalados. Sem trackers, novos endpoints ou formulários.

## Contrato de conteúdo e aceitação
Dez imagens finais existentes; piscina-v2 conserva cadeiras/guarda-sóis; fachada sem placa; duas fotos de café sem marca.
Quatro categorias e mensagem correspondente; café com link no menu; três espaços na galeria; endereço, horários e WhatsApp conferidos nas fontes registradas em decisions.md.
Não afirmar café incluído, valores, disponibilidade, distância em metros ou comodidades não verificadas.
Verificar 320/768/1024/1440px, teclado, menu Escape, quartos, galeria, pausa, imagens carregadas, console e rotas públicas/protegidas.
Sistema administrativo, autenticação, banco e backend fora do escopo.

## Screening — ajustes e resultado

Composição implementada e conferida em 13/09/2026. O enquadramento do hero foi
ajustado de 2,25:1 para 1,85:1 com alinhamento superior no desktop, preservando
os guarda-sóis. No celular usa 4:3. Em 320px o cabeçalho foi compactado e o
título reduzido para 38px para manter duas linhas. O código abaixo já incorpora
esses ajustes. Sem mudança da direção aprovada. Detalhes de testes e limites
de validação em ../LANDING-MARAZUL.md.

## Implementação completa
Os arquivos abaixo são a fonte de verdade para layout, entradas e interações. Ajustes posteriores de screening devem ser registrados ao fim deste documento.

### landing-content.ts

```tsx
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
```

### useHotelMotion.ts

```tsx
"use client";

import { useEffect, useRef } from "react";

export function useHotelMotion(paused: boolean) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    const update = () => {
      observer?.disconnect();
      if (paused || preference.matches) {
        root.querySelectorAll<HTMLElement>("[data-reveal]").forEach(node => {
          node.dataset.seen = "true";
          delete node.dataset.entered;
        });
        return;
      }
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const node = entry.target as HTMLElement;
            node.dataset.seen = "true";
            node.dataset.entered = "true";
            observer?.unobserve(node);
          }
        });
      }, { threshold: 0.12 });
      root.querySelectorAll("[data-reveal]:not([data-seen])").forEach(node => observer?.observe(node));
    };
    update();
    preference.addEventListener("change", update);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", update);
    };
  }, [paused]);

  return rootRef;
}
```

### HotelSpaces.tsx

```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { FiCheck } from "react-icons/fi";
import { ACCOMMODATIONS, getRoomReservationUrl } from "./landing-content";
import styles from "./landing.module.css";

export default function HotelSpaces() {
  const [roomIndex, setRoomIndex] = useState(0);
  const room = ACCOMMODATIONS[roomIndex];

  return (
    <section id="acomodacoes" className={styles.rooms} aria-labelledby="rooms-title">
      <div className={styles.sectionHeading}>
        <h2 id="rooms-title">Seu cantinho<br />no litoral.</h2>
        <p>Quatro jeitos de ficar à vontade.<br />Encontre o que combina com a sua viagem.</p>
      </div>
      <div className={styles.roomOptions} role="group" aria-label="Escolha uma categoria de acomodação">
        {ACCOMMODATIONS.map((item, index) => (
          <button type="button" key={item.name} aria-pressed={roomIndex === index}
            aria-controls="room-details" onClick={() => setRoomIndex(index)}>
            {item.name}{roomIndex === index && <FiCheck aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className={styles.roomPresentation} id="room-details" data-reveal="lateral">
        <div className={styles.roomPhoto}>
          <Image key={room.image} className={styles.photoTransition} src={room.image} alt={room.alt}
            fill sizes="(max-width: 760px) 92vw, 60vw" />
        </div>
        <div className={styles.roomDescription}>
          <div aria-live="polite" aria-atomic="true">
            <h3>{room.name}</h3>
            <p>{room.description}</p>
            <ul>{room.details.map(detail => <li key={detail}><FiCheck aria-hidden="true" />{detail}</li>)}</ul>
          </div>
          <a className={styles.textLink} href={getRoomReservationUrl(room.name)} target="_blank" rel="noopener noreferrer">
            Consultar esta acomodação
          </a>
          <span className={styles.roomNote}>Datas e valores com a nossa equipe.</span>
        </div>
      </div>
    </section>
  );
}
```

### HotelBreakfast.tsx

```tsx
import Image from "next/image";
import { HOTEL_IMAGES } from "./landing-content";
import styles from "./landing.module.css";

export default function HotelBreakfast() {
  return (
    <section id="cafe-da-manha" className={styles.breakfast} aria-labelledby="breakfast-title">
      <div className={styles.breakfastHeading}>
        <p>Café da manhã</p>
        <h2 id="breakfast-title">Bom dia.<br />Sem olhar o relógio.</h2>
      </div>
      <figure className={styles.breakfastMain} data-reveal="wipe">
        <div className={styles.breakfastPhoto}>
          <Image src={HOTEL_IMAGES.breakfast} alt="Buffet de café da manhã do Marazul, com frutas, pães, bolos e bebidas"
            fill sizes="(max-width: 760px) 92vw, 62vw" />
        </div>
        <figcaption>Um começo de dia com gostinho de férias.</figcaption>
      </figure>
      <div className={styles.breakfastSide}>
        <div className={styles.restaurantPhoto}>
          <Image src={HOTEL_IMAGES.restaurant} alt="Salão do café da manhã, com mesas e buffet do Hotel Marazul"
            fill sizes="(max-width: 760px) 85vw, 30vw" />
        </div>
        <p>Puxe uma cadeira. Entre uma xícara de café e uma boa conversa, o dia encontra o seu ritmo.</p>
        <p className={styles.smallPrint}>Consulte a equipe sobre o café da manhã na sua estadia.</p>
      </div>
    </section>
  );
}
```

### HotelLeisure.tsx

```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { FiArrowLeft, FiArrowRight, FiWifi } from "react-icons/fi";
import { LANDING_GALLERY } from "./landing-content";
import styles from "./landing.module.css";

export default function HotelLeisure() {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = LANDING_GALLERY[photoIndex];
  const next = LANDING_GALLERY[(photoIndex + 1) % LANDING_GALLERY.length];

  return (
    <section id="experiencias" className={styles.experiences} aria-labelledby="experiences-title">
      <div className={styles.sectionHeading}>
        <h2 id="experiences-title">Fazer nada.<br />Ou fazer de tudo um pouco.</h2>
        <p>Um mergulho, uma partida, uma conversa.<br />Por aqui, o melhor programa é estar junto.</p>
      </div>
      <div className={styles.leisureLayout} data-reveal="dissolve">
        <div className={styles.gallery}>
          <div className={styles.galleryPhoto} id="hotel-gallery">
            <Image key={photo.src} className={styles.photoTransition} src={photo.src} alt={photo.alt}
              fill sizes="(max-width: 760px) 92vw, 62vw" />
          </div>
          <div className={styles.galleryCaption}>
            <div aria-live="polite" aria-atomic="true"><h3>{photo.title}</h3><p>{photo.caption}</p></div>
            <div className={styles.galleryArrows}>
              <button type="button" aria-label="Foto anterior" aria-controls="hotel-gallery"
                onClick={() => setPhotoIndex(index => (index + LANDING_GALLERY.length - 1) % LANDING_GALLERY.length)}><FiArrowLeft aria-hidden="true" /></button>
              <button type="button" aria-label="Próxima foto" aria-controls="hotel-gallery"
                onClick={() => setPhotoIndex(index => (index + 1) % LANDING_GALLERY.length)}><FiArrowRight aria-hidden="true" /></button>
            </div>
          </div>
        </div>
        <aside className={styles.leisureAside} aria-label="Explore os espaços do hotel">
          <button type="button" className={styles.nextPhoto} aria-label={`Ver foto: ${next.label}`}
            onClick={() => setPhotoIndex(index => (index + 1) % LANDING_GALLERY.length)}>
            <Image src={next.src} alt="" fill sizes="(max-width: 760px) 44vw, 28vw" />
            <span>{next.label}<FiArrowRight aria-hidden="true" /></span>
          </button>
          <div className={styles.galleryOptions} role="group" aria-label="Fotos do hotel">
            {LANDING_GALLERY.map((item, index) => (
              <button type="button" key={item.src} aria-pressed={photoIndex === index} aria-controls="hotel-gallery"
                onClick={() => setPhotoIndex(index)}>{item.label}<span aria-hidden="true">{photoIndex === index ? "●" : "○"}</span></button>
            ))}
          </div>
          <p className={styles.wifiNote}><FiWifi aria-hidden="true" /> Wi-Fi para compartilhar as boas lembranças.</p>
        </aside>
      </div>
    </section>
  );
}
```

### HotelLanding.tsx

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { FiArrowDown, FiMapPin, FiMenu, FiPause, FiPlay, FiX } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import HotelLogo from "../layout/HotelLogo";
import { HOTEL_IMAGES, LANDING_NAVIGATION, WHATSAPP_RESERVATION_URL } from "./landing-content";
import { useHotelMotion } from "./useHotelMotion";
import HotelSpaces from "./HotelSpaces";
import HotelBreakfast from "./HotelBreakfast";
import HotelLeisure from "./HotelLeisure";
import styles from "./landing.module.css";

export default function HotelLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const rootRef = useHotelMotion(paused);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={styles.landing} data-paused={paused}>
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <header className={styles.header} onKeyDown={event => {
        if (event.key === "Escape" && menuOpen) closeMenu();
      }}>
        <Link href="/" className={styles.logo} aria-label="Hotel Marazul, início"><HotelLogo /></Link>
        <button type="button" ref={menuButtonRef} className={styles.menuButton}
          aria-expanded={menuOpen} aria-controls="hotel-navigation" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}</button>
        <nav className={styles.navigation} aria-label="Navegação do hotel" id="hotel-navigation" data-open={menuOpen}>
          {LANDING_NAVIGATION.map(item => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
        </nav>
        <a className={styles.headerBooking} href={WHATSAPP_RESERVATION_URL} target="_blank" rel="noopener noreferrer">
          <FaWhatsapp aria-hidden="true" />Consultar estadia
        </a>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <p className={styles.heroLocation}><FiMapPin aria-hidden="true" />Curumim, Rio Grande do Sul</p>
          <h1 id="hero-title" data-reveal="title">Dias leves.<br />Boas lembranças.</h1>
          <p className={styles.heroSubtitle}>Seu descanso a três quadras do mar.</p>
          <div className={styles.heroFrame} data-reveal="frame">
            <div className={styles.heroMedia}>
              <Image src={HOTEL_IMAGES.pool} alt="Piscinas e pátio do Hotel Marazul, com cadeiras e guarda-sóis"
                fill priority sizes="(max-width: 760px) 94vw, 90vw" />
            </div>
          </div>
          <div className={styles.heroFooter}>
            <span>Um lugar para voltar.</span>
            <a href="#o-hotel">Conheça o Marazul <FiArrowDown aria-hidden="true" /></a>
            <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused}>
              {paused ? <FiPlay aria-hidden="true" /> : <FiPause aria-hidden="true" />}
              {paused ? "Retomar movimento" : "Pausar movimento"}
            </button>
          </div>
        </section>
        <section className={styles.intro} id="o-hotel" aria-labelledby="intro-title">
          <figure className={styles.introFigure}>
            <div className={styles.introPhoto}>
              <Image src={HOTEL_IMAGES.arrival} alt="Fachada e entrada do Hotel Marazul na Avenida Aimoré"
                fill sizes="(max-width: 760px) 92vw, 47vw" />
            </div>
            <figcaption>Av. Aimoré, 250. Pode chegar.</figcaption>
          </figure>
          <div className={styles.introText}>
            <p>Bem-vindo ao Hotel Marazul</p>
            <h2 id="intro-title">Uma pausa<br />que faz bem.</h2>
            <p>Tem coisa que só os dias de praia têm. A conversa que se estende, o mergulho no meio da tarde, a vontade de ficar mais um pouquinho.</p>
            <p>Na avenida principal de Curumim, estamos a três quadras do mar e bem perto do que importa: tempo com quem você gosta.</p>
            <a className={styles.textLink} href="#acomodacoes">Encontre o seu cantinho</a>
          </div>
        </section>
        <HotelSpaces />
        <HotelBreakfast />
        <HotelLeisure />
        <section className={styles.contact} id="contato" aria-labelledby="contact-title">
          <div className={styles.contactLocation}>
            <div><FiMapPin className={styles.pin} aria-hidden="true" /><h2 id="contact-title">Um endereço<br />para guardar.</h2></div>
            <div className={styles.contactDetails}>
              <address>Avenida Aimoré, 250<br />Curumim, Capão da Canoa — RS</address>
              <p>A três quadras da praia.</p>
              <a className={styles.textLink} href="https://www.google.com/maps/search/?api=1&query=Hotel+Marazul+Avenida+Aimor%C3%A9+250+Curumim"
                target="_blank" rel="noopener noreferrer">Abrir no mapa</a>
              <dl className={styles.contactHours}><div><dt>Check-in</dt><dd>A partir das 14h</dd></div><div><dt>Check-out</dt><dd>Até as 12h</dd></div></dl>
            </div>
          </div>
          <div className={styles.contactInvitation}>
            <p>A próxima lembrança é sua.</p>
            <h3>Vamos combinar<br />seus dias por aqui?</h3>
            <a className={styles.primaryButton} href={WHATSAPP_RESERVATION_URL} target="_blank" rel="noopener noreferrer">
              <FaWhatsapp aria-hidden="true" />Conversar no WhatsApp
            </a>
            <p>Consulte datas, acomodações e valores com a nossa equipe.</p>
            <a className={styles.phone} href="tel:+5551982180262">(51) 9 8218-0262</a>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <Link href="/" aria-label="Hotel Marazul, início"><HotelLogo /></Link>
        <p>Curumim fica na memória.</p>
        <nav aria-label="Links do rodapé">{LANDING_NAVIGATION.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        <div className={styles.footerBase}><span>Hotel Marazul · Curumim, RS</span><Link href="/login">Acesso da equipe</Link></div>
      </footer>
    </div>
  );
}
```

### landing.module.css

```css
.landing {
  --deep: #163e50;
  --mist: #e7f0f2;
  --paper: #fafbf7;
  --water: #bfd8df;
  --sun: #f0ca79;
  --muted: #526a72;
  --line: #b7cbd1;
  --page-width: 1248px;
  --gutter: clamp(20px, 5vw, 80px);
  color: var(--deep);
  background: var(--paper);
  font-family: "Trebuchet MS", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.65;
}
.landing *, .landing *::before, .landing *::after { box-sizing: border-box; }
.landing h1, .landing h2, .landing h3, .landing p, .landing figure { margin: 0; }
.landing h1, .landing h2, .landing h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; text-wrap: balance; }
.landing h2 { font-size: clamp(36px, 4.1vw, 60px); line-height: 1.1; letter-spacing: -.035em; }
.landing h3 { font-size: clamp(28px, 3vw, 40px); line-height: 1.2; }
.landing a { color: inherit; text-decoration: none; }
.landing button { color: inherit; font: inherit; cursor: pointer; }
.landing button, .landing a { -webkit-tap-highlight-color: transparent; }
.landing :is(a, button):focus-visible { outline: 3px solid currentColor; outline-offset: 5px; }
.landing section { scroll-margin-top: 112px; }
.landing img { object-fit: cover; }
.landing figcaption { font-size: 14px; margin-top: 12px; color: var(--muted); }
.header { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 28px; padding: 12px var(--gutter); min-height: 92px; background: var(--mist); border-bottom: 1px solid var(--line); }
.logo { width: 128px; flex-shrink: 0; display: flex; align-items: center; }
.navigation { display: flex; justify-content: center; gap: clamp(16px, 2.1vw, 32px); margin-left: auto; }
.navigation a, .footer nav a { font-size: 14px; white-space: nowrap; position: relative; padding: 10px 0; }
.navigation a::after, .footer nav a::after { content: ""; position: absolute; left: 0; bottom: 5px; width: 100%; height: 1px; background: currentColor; transform: scaleX(0); transform-origin: left; transition: transform .2s; }
.navigation a:hover::after, .footer nav a:hover::after { transform: scaleX(1); }
.headerBooking, .primaryButton { display: inline-flex; justify-content: center; align-items: center; gap: 10px; min-height: 48px; padding: 12px 22px; background: var(--sun); border: 1px solid transparent; font-size: 14px; font-weight: 700; transition: background .2s; }
.headerBooking { margin-left: auto; white-space: nowrap; }
.headerBooking:hover, .primaryButton:hover { background: var(--water); }
.headerBooking svg, .primaryButton svg { width: 20px; height: 20px; }
.menuButton { display: none; }
.hero { background: var(--mist); text-align: center; padding: 44px var(--gutter) 0; }
.heroLocation { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--muted); font-size: 14px; }
.hero h1 { font-size: clamp(50px, 6.6vw, 94px); line-height: .99; letter-spacing: -.05em; margin: 22px 0; }
.heroSubtitle { font-size: 17px; color: var(--muted); margin-bottom: 32px !important; }
.heroFrame { max-width: var(--page-width); margin: auto; padding: 12px; background: var(--paper); border: 1px solid var(--line); position: relative; }
.heroFrame::before, .heroFrame::after { content: ""; position: absolute; width: 32px; height: 32px; border-color: var(--deep); pointer-events: none; z-index: 1; }
.heroFrame::before { left: -5px; top: -5px; border-left: 1px solid; border-top: 1px solid; }
.heroFrame::after { right: -5px; bottom: -5px; border-right: 1px solid; border-bottom: 1px solid; }
.heroMedia { position: relative; aspect-ratio: 1.85; overflow: hidden; background: var(--water); }
.heroMedia img { object-position: center top; }
.heroFooter { max-width: var(--page-width); margin: auto; min-height: 78px; display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 13px; }
.heroFooter a, .heroFooter button { display: flex; gap: 10px; align-items: center; min-height: 44px; }
.heroFooter button { border: none; background: transparent; padding: 8px 0; font-size: 12px; color: var(--muted); }
.intro { max-width: calc(var(--page-width) + var(--gutter) * 2); margin: auto; padding: 112px var(--gutter); display: grid; grid-template-columns: 1.1fr 1fr; gap: clamp(36px, 7vw, 112px); align-items: center; }
.introPhoto { position: relative; aspect-ratio: 1.18; background: var(--water); }
.introFigure { padding: 12px 12px 0; border: 1px solid var(--line); }
.introFigure figcaption { padding-bottom: 12px; text-align: center; }
.introText > p:first-child { font-size: 14px; }
.introText h2 { margin: 20px 0 28px; }
.introText > p { max-width: 42ch; color: var(--muted); margin-bottom: 20px; }
.textLink { display: inline-block; padding: 8px 0; border-bottom: 1px solid currentColor; font-weight: 700; font-size: 14px; }
.textLink:hover { color: var(--muted); }
.rooms { padding: 88px var(--gutter) 104px; background: var(--mist); }
.sectionHeading { max-width: var(--page-width); margin: 0 auto 40px; display: flex; align-items: end; justify-content: space-between; gap: 32px; }
.sectionHeading p { color: var(--muted); max-width: 38ch; }
.roomOptions { display: flex; max-width: var(--page-width); margin: auto; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.roomOptions button { display: flex; justify-content: center; align-items: center; gap: 16px; flex: 1; background: transparent; border: none; padding: 20px 12px; font-size: 17px; min-height: 64px; }
.roomOptions button[aria-pressed="true"] { background: var(--deep); color: var(--paper); }
.roomOptions button:hover:not([aria-pressed="true"]) { background: var(--water); }
.roomPresentation { max-width: var(--page-width); margin: 32px auto 0; display: grid; grid-template-columns: 1.6fr 1fr; align-items: stretch; }
.roomPhoto { position: relative; min-height: 420px; background: var(--water); overflow: hidden; }
.roomDescription { padding: 40px; background: var(--paper); display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
.roomDescription h3 { margin-bottom: 20px; }
.roomDescription p { color: var(--muted); max-width: 35ch; }
.roomDescription ul { padding: 0; margin: 24px 0; list-style: none; font-size: 14px; }
.roomDescription li { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.roomNote { color: var(--muted); font-size: 12px; margin-top: 12px; }
.breakfast { max-width: calc(var(--page-width) + var(--gutter) * 2); margin: auto; padding: 112px var(--gutter); display: grid; grid-template-columns: 1.65fr 1fr; gap: 36px 60px; }
.breakfastHeading { grid-column: 1 / -1; }
.breakfastHeading > p { font-size: 14px; color: var(--muted); margin-bottom: 16px; }
.breakfastPhoto { aspect-ratio: 1.4; position: relative; background: var(--water); }
.breakfastSide { padding-top: 72px; }
.restaurantPhoto { position: relative; aspect-ratio: 1.4; margin-bottom: 28px; background: var(--water); }
.breakfastSide p { max-width: 35ch; color: var(--muted); }
.breakfastSide .smallPrint { font-size: 12px; margin-top: 20px; }
.experiences { background: var(--deep); color: var(--paper); padding: 88px var(--gutter); }
.experiences .sectionHeading { margin-bottom: 48px; }
.experiences .sectionHeading p { color: var(--water); }
.experiences h2 { font-size: clamp(36px, 3.8vw, 56px); }
.leisureLayout { max-width: var(--page-width); margin: auto; display: grid; grid-template-columns: 1.9fr 1fr; gap: 56px; }
.galleryPhoto { position: relative; aspect-ratio: 1.4; background: var(--muted); overflow: hidden; }
.galleryCaption { display: flex; justify-content: space-between; align-items: start; gap: 24px; padding-top: 24px; }
.galleryCaption h3 { font-size: clamp(26px, 2.5vw, 36px); }
.galleryCaption p { font-size: 14px; color: var(--water); margin-top: 12px; max-width: 48ch; }
.galleryArrows { display: flex; gap: 8px; flex-shrink: 0; }
.galleryArrows button { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--water); border-radius: 50%; background: transparent; }
.galleryArrows button:hover { background: var(--paper); color: var(--deep); }
.leisureAside { padding-top: 64px; }
.nextPhoto { display: block; width: 100%; position: relative; aspect-ratio: 1.2; border: 8px solid var(--paper); padding: 0; background: var(--water); }
.nextPhoto span { position: absolute; bottom: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; background: var(--paper); color: var(--deep); padding: 10px 12px; font-size: 13px; }
.galleryOptions { margin: 24px 0; }
.galleryOptions button { display: flex; justify-content: space-between; gap: 12px; width: 100%; text-align: left; background: transparent; border: none; border-bottom: 1px solid var(--muted); padding: 12px 0; min-height: 48px; font-size: 14px; }
.galleryOptions button[aria-pressed="true"] { color: var(--sun); font-weight: 700; }
.wifiNote { display: flex; gap: 12px; align-items: center; color: var(--water); font-size: 13px; max-width: 32ch; }
.wifiNote svg { flex-shrink: 0; width: 20px; height: 20px; }
.contact { padding: 96px var(--gutter) 0; background: var(--paper); }
.contactLocation { max-width: 1000px; margin: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; padding-bottom: 80px; }
.pin { width: 28px; height: 28px; margin-bottom: 20px; }
.contactDetails address { font-style: normal; font-size: 18px; }
.contactDetails p { color: var(--muted); font-size: 14px; margin-top: 8px; }
.contactDetails .textLink { margin-top: 12px; }
.contactHours { display: flex; flex-wrap: wrap; gap: 32px; margin: 28px 0 0; padding-top: 24px; border-top: 1px solid var(--line); }
.contactHours dt { color: var(--muted); font-size: 13px; }
.contactHours dd { margin: 4px 0 0; font-size: 16px; }
.contactInvitation { background: var(--water); text-align: center; padding: 64px 24px; max-width: var(--page-width); margin: auto; }
.contactInvitation h3 { font-size: clamp(40px, 5vw, 68px); letter-spacing: -.04em; line-height: 1.05; margin: 20px 0 28px; }
.contactInvitation > p { font-size: 14px; }
.contactInvitation .primaryButton { margin-bottom: 20px; }
.contactInvitation .primaryButton:hover { background: var(--paper); }
.phone { display: inline-block; padding: 12px; margin-top: 4px; font-size: 14px; }
.footer { padding: 48px var(--gutter) 20px; background: var(--paper); text-align: center; }
.footer > a { display: inline-block; width: 160px; }
.footer > p { font-family: Georgia, serif; font-size: 23px; margin: 12px 0 16px; }
.footer nav { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 28px; }
.footerBase { display: flex; justify-content: space-between; align-items: center; gap: 20px; max-width: var(--page-width); margin: 36px auto 0; padding-top: 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
.footerBase a { padding: 10px 0; }
.photoTransition { animation: dissolve .3s ease-out; }
.landing [data-entered="true"][data-reveal="title"] { animation: titleReveal .65s ease-out both; }
.landing [data-entered="true"][data-reveal="frame"] { animation: frameReveal .8s ease-out both; }
.landing [data-entered="true"][data-reveal="lateral"] { animation: lateralReveal .4s ease-out both; }
.landing [data-entered="true"][data-reveal="wipe"] { animation: wipeReveal .45s ease-out both; }
.landing [data-entered="true"][data-reveal="dissolve"] { animation: dissolve .4s ease-out both; }
.landing[data-paused="true"] *, .landing[data-paused="true"] *::before, .landing[data-paused="true"] *::after { animation: none !important; transition: none !important; }
@keyframes titleReveal { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0); } }
@keyframes frameReveal { from { clip-path: inset(0 12%); } to { clip-path: inset(-8px); } }
@keyframes lateralReveal { from { transform: translateX(-16px); } to { transform: translateX(0); } }
@keyframes wipeReveal { from { clip-path: inset(0 8% 0 0); } to { clip-path: inset(0); } }
@keyframes dissolve { from { opacity: .35; } to { opacity: 1; } }
@media (min-width: 1600px) { .header { padding-inline: max(var(--gutter), calc((100vw - var(--page-width)) / 2)); } }
@media (max-width: 1100px) {
  .header { gap: 20px; padding-inline: 24px; }
  .navigation { gap: 16px; }
  .navigation a { font-size: 13px; }
  .headerBooking { padding: 12px 16px; font-size: 13px; }
  .logo { width: 108px; }
  .roomDescription { padding: 28px; }
  .leisureLayout { gap: 32px; }
}
@media (max-width: 900px) {
  .header { min-height: 80px; flex-wrap: wrap; gap: 16px; }
  .menuButton { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--line); background: transparent; order: 3; }
  .headerBooking { margin-left: auto; }
  .navigation { display: none; order: 4; width: 100%; margin: 0; padding: 8px 0; }
  .navigation[data-open="true"] { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 8px 24px; }
  .navigation a { font-size: 15px; min-height: 44px; }
  .sectionHeading { align-items: start; }
}
@media (max-width: 760px) {
  .landing { --gutter: 20px; }
  .landing section { scroll-margin-top: 96px; }
  .hero { padding-top: 36px; }
  .hero h1 { font-size: clamp(48px, 10vw, 74px); margin-block: 20px; }
  .heroSubtitle { font-size: 15px; margin-bottom: 28px !important; }
  .heroFrame { padding: 7px; }
  .heroMedia { aspect-ratio: 4 / 3; }
  .heroMedia img { object-position: center; }
  .heroFooter { min-height: 88px; gap: 8px; }
  .heroFooter > span { display: none; }
  .heroFooter a { font-size: 12px; }
  .heroFooter button { font-size: 11px; gap: 6px; }
  .intro { padding-block: 64px; grid-template-columns: 1fr; gap: 36px; }
  .introText h2 { margin: 16px 0 24px; }
  .introText > p { max-width: 54ch; }
  .introPhoto { aspect-ratio: 1.3; }
  .rooms { padding-block: 60px; }
  .sectionHeading { flex-direction: column; gap: 24px; margin-bottom: 28px; }
  .sectionHeading p { font-size: 15px; }
  .roomOptions { display: grid; grid-template-columns: 1fr 1fr; }
  .roomOptions button { min-height: 52px; padding: 12px; font-size: 15px; }
  .roomPresentation { grid-template-columns: 1fr; margin-top: 20px; }
  .roomPhoto { min-height: 0; aspect-ratio: 1.3; }
  .roomDescription { padding: 28px; }
  .roomDescription p { max-width: 54ch; }
  .breakfast { padding-block: 64px; grid-template-columns: 1fr; gap: 28px; }
  .breakfastSide { padding-top: 0; padding-left: 32px; }
  .breakfastSide p { max-width: 48ch; }
  .breakfastPhoto { aspect-ratio: 1.25; }
  .restaurantPhoto { aspect-ratio: 1.6; }
  .experiences { padding-block: 64px; }
  .leisureLayout { grid-template-columns: 1fr; gap: 32px; }
  .galleryPhoto { aspect-ratio: 1.25; }
  .galleryCaption { flex-direction: column; gap: 20px; }
  .galleryArrows { align-self: flex-end; }
  .leisureAside { padding-top: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center; }
  .nextPhoto { aspect-ratio: 1; border-width: 5px; }
  .nextPhoto span { font-size: 11px; padding: 8px 4px; }
  .galleryOptions { margin: 0; }
  .galleryOptions button { font-size: 13px; }
  .wifiNote { grid-column: 1 / -1; max-width: none; }
  .contact { padding-top: 64px; }
  .contactLocation { grid-template-columns: 1fr; gap: 32px; padding-bottom: 48px; }
  .contactInvitation { padding: 48px 20px; }
  .contactInvitation > p { max-width: 32ch; margin-inline: auto; }
  .footer { padding-top: 40px; }
  .footerBase { flex-wrap: wrap; justify-content: center; gap: 0 20px; }
}
@media (max-width: 380px) {
  .header { padding-inline: 12px; gap: 8px; }
  .logo { width: 80px; }
  .headerBooking { padding-inline: 10px; font-size: 11px; gap: 6px; }
  .headerBooking svg { width: 16px; }
  .menuButton { width: 40px; }
  .heroLocation { font-size: 12px; }
  .hero h1 { font-size: 38px; }
  .heroFooter { flex-wrap: wrap; justify-content: center; gap: 0; padding-block: 8px; }
  .heroFooter a, .heroFooter button { justify-content: center; width: 100%; min-height: 32px; }
  .roomDescription { padding: 24px; }
  .leisureAside { grid-template-columns: 1fr; }
  .nextPhoto { width: 70%; }
}
@media (prefers-reduced-motion: reduce) {
  .landing *, .landing *::before, .landing *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```
