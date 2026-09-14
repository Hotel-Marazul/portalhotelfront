import type { ReactNode } from "react";
interface PageSectionProps { title: string; description?: string; actions?: ReactNode; children: ReactNode; }
export default function PageSection({ title, description, actions, children }: PageSectionProps) {
  return <section className="page-section">
    <div className="section-header">
      <div><h2>{title}</h2>{description && <p className="section-description">{description}</p>}</div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
    <div className="section-body">{children}</div>
  </section>;
}
