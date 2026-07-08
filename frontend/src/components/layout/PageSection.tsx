import type { ReactNode } from "react";

interface PageSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageSection({ title, description, actions, children }: PageSectionProps) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h3
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "1.45rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.1,
            }}
          >
            {title}
          </h3>
          {description && (
            <p
              style={{
                margin: 0,
                color: "var(--text-muted)",
                fontSize: "0.9rem",
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          )}
        </div>

        {actions && <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>{actions}</div>}
      </div>

      <div>{children}</div>
    </section>
  );
}
