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
