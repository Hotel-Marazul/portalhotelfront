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
