"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { FiLogOut } from "react-icons/fi";
import apiClient from "../services/api";
import { APP_SECTIONS, HEADER_HEIGHT } from "../config/navigation";

export default function Sidenav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiClient.post("/api/User/logout");
    } catch {
      // Redirect anyway to avoid client-side stale auth state.
    } finally {
      router.replace("/login");
    }
  }

  return (
    <aside
      className="fixed top-0 left-0 z-50 flex h-full w-48 flex-col"
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-5"
        style={{ height: `${HEADER_HEIGHT}px`, borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div
          className="flex items-center justify-center rounded-md text-xs font-bold shrink-0"
          style={{ width: "28px", height: "28px", background: "var(--accent)", color: "#fff" }}
        >
          PH
        </div>
        <span
          className="text-sm font-semibold"
          style={{ color: "#f1f5f9", letterSpacing: "-0.01em" }}
        >
          Portal Hotel
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {APP_SECTIONS.map((section) => (
          <div key={section.label} className="mb-3">
            <div className="px-5 pb-2 pt-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {section.label}
            </div>
            {section.items.map(({ key, path, label, Icon, size }) => {
              const isActive = pathname === path;
              return (
                <Link
                  key={key}
                  href={path}
                  className={`sidebar-link${isActive ? " active" : ""}`}
                >
                  <Icon
                    size={size}
                    className="sidebar-icon"
                    style={{
                      color: isActive ? "var(--accent)" : "var(--sidebar-text)",
                      flexShrink: 0,
                    }}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ borderTop: "1px solid var(--sidebar-border)", paddingTop: "12px", paddingBottom: "12px" }}>
        <button
          type="button"
          className="sidebar-logout"
          onClick={() => void handleLogout()}
        >
          <FiLogOut size={16} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
