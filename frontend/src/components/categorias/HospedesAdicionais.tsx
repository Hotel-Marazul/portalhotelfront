import { cx } from "../ui/cx";
import { describeRule, sortRules, type PricingRuleDto } from "./tarifas-data";

interface HospedesAdicionaisProps {
  status: "loading" | "error" | "ready";
  rules: PricingRuleDto[];
  /** Só o gerente recebe estas ações; sem elas a lista é só leitura. */
  onCreate?: () => void;
  onEdit?: (rule: PricingRuleDto) => void;
}

const linkClass = "cursor-pointer border-0 bg-transparent p-0 text-[13px] text-fg-2 underline underline-offset-4 hover:text-fg";

// Regras de /api/pricing-rules. Criar e editar: POST e PUT /api/pricing-rules (só gerente).
export default function HospedesAdicionais({ status, rules, onCreate, onEdit }: HospedesAdicionaisProps) {
  return (
    <section aria-labelledby="adicionais" className="flex shrink-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="adicionais" className="m-0 text-[15px] font-semibold">Hóspedes adicionais</h2>
        {onCreate && <button type="button" onClick={onCreate} className={linkClass}>Nova regra</button>}
      </div>
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
                  {onEdit && (
                    <td className="w-0 py-2.5 pl-4 text-right whitespace-nowrap">
                      <button type="button" onClick={() => onEdit(rule)} aria-label={`Editar ${rule.name}`} className={linkClass}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
