import { z } from "zod";

function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (digits: string, weights: number[]) =>
    digits.split("").reduce((sum, d, i) => sum + Number(d) * weights[i], 0);

  const w1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const r1 = (calc(cpf.slice(0, 9), w1) * 10) % 11;
  const d1 = r1 >= 10 ? 0 : r1;
  if (d1 !== Number(cpf[9])) return false;

  const w2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const r2 = (calc(cpf.slice(0, 10), w2) * 10) % 11;
  const d2 = r2 >= 10 ? 0 : r2;
  return d2 === Number(cpf[10]);
}

export const clientBodySchema = z.object({
  fullName: z.string().min(3),
  cpf: z.string().min(11).max(14).refine(isValidCpf, { message: "CPF inválido." }),
  email: z.string().email(),
  fone: z.string().min(8),
  automovel: z.string().optional().default(""),
  placa: z.string().optional().default("")
});

export const clientIdSchema = z.object({
  id: z.string().uuid()
});
