import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { TodoItem } from "./today-data";

// No máximo quatro itens; cada um leva à tela onde se resolve.
export default function TodoList({ items, loading }: { items: TodoItem[]; loading: boolean }) {
  return (
    <section aria-labelledby="a-fazer" className="flex min-h-0 flex-col">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id="a-fazer" className="m-0 text-[15px] font-semibold">A fazer</h2>
        <Link href="/reservas?vista=lista" className="text-[13px] text-fg-2 underline-offset-4 hover:text-fg">Ver todas</Link>
      </div>
      {loading && items.length === 0 ? (
        <span aria-busy="true" className="mt-2 block h-12 animate-pulse rounded-bar bg-muted"><span className="sr-only">Carregando</span></span>
      ) : items.length === 0 ? (
        <p className="m-0 py-4 text-[13px] text-fg-3">Nada pendente agora.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="flex min-h-12 items-center justify-between gap-3 border-b border-rule py-1.5 text-fg no-underline hover:bg-bg">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="text-xs text-fg-3">{item.detail}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
