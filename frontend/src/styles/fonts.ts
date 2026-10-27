import { Geist_Mono, Hanken_Grotesk } from "next/font/google";

// As duas são variáveis: um arquivo cobre os pesos 400–700 do desenho.
export const hankenGrotesk = Hanken_Grotesk({ subsets: ["latin"], display: "swap", variable: "--font-hanken" });

// Só para horas, números de quarto, valores e datas em tabela.
export const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-geist-mono" });
