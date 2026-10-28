import { cx } from "../ui/cx";
import { describeRule, sortRules, type PricingRuleDto } from "./tarifas-data";

interface HospedesAdicionaisProps {
  status: "loading" | "error" | "ready";
  rules: PricingRuleDto[];
}

// Regras de /api/pricing-rules. O backend só lê as regras; não há rota para criar ou editar.
export default function HospedesAdicionais({ status, rules }: HospedesAdicionaisProps) {
  return (
    <section aria-labelledby="adicionais" className="flex shrink-0 flex-col gap-1.5">
      <h2 id="adicionais" className="m-0 text-[15px] font-semibold">Hóspedes adicionais</h2>
      <p className="m-0 mb-1 text-[13px] text-fg-3">
        As duas primeiras pessoas já estão na tarifa de casal. Cobrados a partir da 3ª pessoa, em só café e meia pensão.
      </p>
      {status === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Carregando</span>
          {[0, 1, 2].map((row) => <span key={row} aria-hidden="true" className="h-8 animate-pulse rounded-bar bg-muted" />)}
        </div>
      )}
      {status === "error" && <p role="alert" className="m-0 text-[13px] text-danger">Não foi possível carregar as regras de hóspede adicional.</p>}
      {status === "ready" && rules.length === 0 && <p className="m-0 text-[13px] text-fg-3">Nenhuma regra cadastrada.</p>}
      {status === "ready" && rules.length > 0 && (
        <table className="w-full border-collapse">
          <tbody>
            {sortRules(rules).map((rule) => {
              const line = describeRule(rule);
              return (
                <tr key={rule.id} className="border-t border-rule">
                  <th scope="row" className="w-[34%] py-2.5 text-left font-medium">{line.age}</th>
                  <td className="py-2.5 text-fg-2">{line.basis}</td>
                  <td className={cx("py-2.5 text-right font-mono", line.free ? "text-accent" : "text-fg")}>{line.value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
