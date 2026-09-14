import Image from "next/image";

/** Crop the transparent canvas in CSS; keep the supplied brand asset intact. */
export default function HotelLogo() {
  return <span className="hotel-logo">
    <Image src="/logo-marazul.png" alt="Hotel Marazul — Curumim, RS" width={1448} height={1086} priority sizes="(max-width: 599px) 176px, 208px" />
  </span>;
}
