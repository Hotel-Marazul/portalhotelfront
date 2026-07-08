import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accentColor?: string;
  icon?: ReactNode;
}

export default function KpiCard({
  label,
  value,
  sub,
  accentColor = "var(--accent)",
  icon,
}: KpiCardProps) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "18px 20px 16px",
        borderLeft: `3px solid ${accentColor}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {icon && (
        <div
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            color: accentColor,
            opacity: 0.3,
          }}
        >
          {icon}
        </div>
      )}
      <span
        style={{
          display: "block",
          fontSize: "0.62rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "5px",
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-display)",
          fontSize: "2.2rem",
          lineHeight: 1,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: sub ? "5px" : 0,
        }}
      >
        {value}
      </span>
      {sub && (
        <span
          style={{
            display: "block",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            lineHeight: 1.4,
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
