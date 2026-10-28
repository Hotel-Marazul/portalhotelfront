import type { Category, Room } from "../../utils/models";
import { categoryUnits, couplePriceOf, formatRate } from "./tarifas-data";

interface TabelaTarifasProps {
  categories: Category[];
  /** null quando a rota de quartos falhou: as unidades não aparecem. */
  rooms: Room[] | null;
  roomsError: boolean;
  onEdit?: (category: Category) => void;
}

const thClass = "sticky top-0 z-[1] bg-surface py-2 text-left text-xs font-medium text-fg-3";

// Diária de casal por categoria, com as unidades de /api/rooms.
export default function TabelaTarifas({ categories, rooms, roomsError, onEdit }: TabelaTarifasProps) {
  if (categories.length === 0) return <p className="m-0 py-6 text-[13px] text-fg-3">Nenhuma categoria cadastrada.</p>;

  return (
    <table className="w-full min-w-[560px] border-collapse">
      <thead>
        <tr>
          <th scope="col" className={thClass}>Categoria</th>
          <th scope="col" className={thClass}>Unidades</th>
          <th scope="col" className={`${thClass} text-right`}>Só café</th>
          <th scope="col" className={`${thClass} text-right`}>Meia pensão</th>
          {onEdit && <th scope="col" className={thClass}><span className="sr-only">Ações</span></th>}
        </tr>
      </thead>
      <tbody>
        {categories.map((category) => {
          const units = rooms ? categoryUnits(rooms, category.id) : null;
          return (
            <tr key={category.id} className="border-t border-rule align-top">
              <th scope="row" className="py-3 pr-4 text-left font-normal">
                <span className="flex flex-col">
                  <span className="font-semibold">{category.name}</span>
                  {units?.capacity && <span className="text-xs text-fg-3">{units.capacity}</span>}
                </span>
              </th>
              <td className="py-3 pr-4">
                {units ? (
                  <span className="flex flex-col">
                    <span className="font-mono text-[13px]">{units.count} {units.count === 1 ? "unidade" : "unidades"}</span>
                    {units.numbers && <span className="text-xs text-fg-3">{units.numbers}</span>}
                    {units.maintenance && <span className="text-xs text-fg-3">{units.maintenance} em manutenção</span>}
                  </span>
                ) : (
                  <span className="text-xs text-danger">{roomsError ? "Não foi possível carregar" : "…"}</span>
                )}
              </td>
              <td className="py-3 text-right font-mono">{formatRate(couplePriceOf(category))}</td>
              <td className="py-3 text-right font-mono">
                {category.halfBoardPrice == null
                  ? <span className="font-sans text-[13px] text-fg-3">Não configurada</span>
                  : formatRate(category.halfBoardPrice)}
              </td>
              {onEdit && (
                <td className="py-3 pl-4 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(category)}
                    aria-label={`Editar ${category.name}`}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-fg-2 underline underline-offset-4 hover:text-fg"
                  >
                    Editar
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
