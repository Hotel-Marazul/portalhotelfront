import type { ReactNode } from "react";
interface KpiCardProps { label: string; value: ReactNode; sub?: ReactNode; accentColor?: string; icon?: ReactNode; }
export default function KpiCard({ label, value, sub, icon }: KpiCardProps) {
  return <div className="kpi-card">
    <span className="kpi-label">{label}<span aria-hidden="true">{icon}</span></span>
    <span className="kpi-value">{value}</span>
    {sub && <span className="kpi-sub">{sub}</span>}
  </div>;
}
