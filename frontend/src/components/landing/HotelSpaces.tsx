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
