import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavLinks from "./NavLinks";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f0f4f8" }}>
      {/* Sidebar */}
      <nav style={{
        width: 230,
        background: "#0c1a2e",
        color: "#d0d8e8",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        borderRight: "1px solid #1a2e48",
      }}>
        {/* Logo */}
        <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid #1a2e48" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 6,
              background: "linear-gradient(135deg, #1e3a5f, #0c1a2e)",
              border: "1px solid #c4a030",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 18, color: "#c4a030", fontFamily: "serif",
              flexShrink: 0,
            }}>G</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#ffffff", lineHeight: 1.2 }}>
                Gélamo <span style={{ color: "#c4a030" }}>Contábil</span>
              </div>
              <div style={{ fontSize: 10, color: "#5a7a9a", marginTop: 2 }}>Gestão de Documentos</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: "16px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <NavLinks />
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1a2e48", fontSize: 11, color: "#3a5a7a" }}>
          Assessoria Contábil e Empresarial
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, padding: 32, overflowX: "auto" }}>{children}</main>
    </div>
  );
}
