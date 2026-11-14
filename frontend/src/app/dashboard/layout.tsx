import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AnonProvider } from "./AnonContext";
import AnonToggle from "./AnonToggle";
import NavLinks from "./NavLinks";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AnonProvider>
    <div style={{ display: "flex", minHeight: "100vh", background: "#f0ede8" }}>
      {/* Sidebar */}
      <nav style={{
        width: 240,
        background: "#0c1a2e",
        color: "#d0d8e8",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        borderRight: "1px solid #1a2e48",
      }}>
        {/* Logo */}
        <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid #1a2e48" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 6,
              background: "rgba(196,160,48,0.08)",
              border: "1.5px solid #c4a030",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 20, color: "#c4a030", fontFamily: "Georgia, serif",
              flexShrink: 0,
            }}>G</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#ffffff", lineHeight: 1.2 }}>
                Gélamo <span style={{ color: "#c4a030" }}>Contábil</span>
              </div>
              <div style={{ fontSize: 10, color: "#4a6a8a", marginTop: 2, letterSpacing: "0.06em" }}>
                ASSESSORIA CONTÁBIL
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: "20px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Section label */}
          <p style={{ fontSize: 10, fontWeight: 700, color: "#2a4a6a", letterSpacing: "0.12em", padding: "0 10px", marginBottom: 8 }}>
            OPERAÇÃO CONTÁBIL
          </p>
          <NavLinks />
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1a2e48", fontSize: 11, color: "#2a4a6a" }}>
          Gestão de Documentos
        </div>
      </nav>

      {/* Content area: top bar + page */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          height: 56,
          background: "#ffffff",
          borderBottom: "1px solid #e8e4de",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: "0.06em", marginBottom: 2 }}>
              Ambiente interno
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#0c1a2e" }}>
              Gestão de Documentos Contábeis
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <AnonToggle />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#c4a030", letterSpacing: "0.12em" }}>
              GÉLAMO CONTÁBIL
            </span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: 32, overflowX: "auto" }}>{children}</main>
      </div>
    </div>
    </AnonProvider>
  );
}
