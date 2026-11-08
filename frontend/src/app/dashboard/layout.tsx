import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 220, background: "#1e293b", color: "white", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Gestão de Docs</span>
        <a href="/dashboard" style={{ padding: "8px 12px", borderRadius: 6, color: "#cbd5e1" }}>Início</a>
        <a href="/dashboard/empresas" style={{ padding: "8px 12px", borderRadius: 6, color: "#cbd5e1" }}>Empresas</a>
        <a href="/dashboard/revisao" style={{ padding: "8px 12px", borderRadius: 6, color: "#cbd5e1" }}>Fila de Revisão</a>
        <a href="/dashboard/relatorios" style={{ padding: "8px 12px", borderRadius: 6, color: "#cbd5e1" }}>Relatórios</a>
        <a href="/dashboard/configuracoes" style={{ padding: "8px 12px", borderRadius: 6, color: "#cbd5e1" }}>Configurações</a>
      </nav>
      <main style={{ flex: 1, padding: 32 }}>{children}</main>
    </div>
  );
}
