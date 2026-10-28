"use client";

import { Suspense } from "react";
import HospedesScreen from "../../components/clientes/createUserTable";

// useSearchParams (busca e cliente vindos da barra de busca) pede um Suspense acima.
export default function HospedesPage() {
  return (
    <Suspense fallback={<div aria-busy="true" className="flex-1"><span className="sr-only">Carregando</span></div>}>
      <HospedesScreen />
    </Suspense>
  );
}
