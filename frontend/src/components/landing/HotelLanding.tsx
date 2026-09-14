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
