import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const [empresasRes, pendentesRes, revisaoRes] = await Promise.all([
    supabase.schema("gestao_docs").from("empresa").select("id", { count: "exact", head: true }),
    supabase.schema("gestao_docs").from("documento").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.schema("gestao_docs").from("fila_revisao").select("id", { count: "exact", head: true }).is("resolvido_em", null),
  ]);

  const totalEmpresas = empresasRes.count ?? 0;
  const totalPendentes = pendentesRes.count ?? 0;
  const totalRevisao = revisaoRes.count ?? 0;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Painel</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <Card title="Empresas monitoradas" value={totalEmpresas} />
        <Card title="Documentos pendentes" value={totalPendentes} color="#f59e0b" />
        <Card title="Aguardando revisão" value={totalRevisao} color="#ef4444" />
      </div>
    </div>
  );
}

function Card({ title, value, color = "#2563eb" }: { title: string; value: number; color?: string }) {
  return (
    <div style={{ background: "white", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 32, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
