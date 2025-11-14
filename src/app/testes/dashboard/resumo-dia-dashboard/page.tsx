import ResumoDiaDashboard from "@/components/dashboard/ResumoDiaDashboard";

export default function ResumoDiaTeste() {
  // Valores chumbados para teste
  const checkIns = 12;
  const checkOuts = 8;
  const receita = 1540;

  return <ResumoDiaDashboard checkIns={checkIns} checkOuts={checkOuts} receita={receita} />;
}
