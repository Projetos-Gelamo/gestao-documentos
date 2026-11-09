import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function ConfiguracoesPage() {
  const supabase = createSupabaseAdminClient();

  const { data: config } = await supabase
    .schema("gestao_docs")
    .from("configuracao_sistema")
    .select("modo_ficticio")
    .limit(1)
    .single();

  const modoFicticio = config?.modo_ficticio ?? true;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Configurações</h1>
      <div style={{ background: "white", borderRadius: 10, padding: 24, maxWidth: 480, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Modo de dados</h2>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
          No modo <strong>fictício</strong>, o sistema exibe somente as 3 empresas de teste.
          No modo <strong>real</strong>, exibe os clientes reais do escritório.
        </p>
        <div style={{
          display: "inline-block",
          padding: "6px 14px",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 600,
          background: modoFicticio ? "#dbeafe" : "#dcfce7",
          color: modoFicticio ? "#1d4ed8" : "#15803d",
        }}>
          {modoFicticio ? "Modo fictício ativo" : "Modo real ativo"}
        </div>
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
          Para alternar entre modos, atualize a tabela <code>gestao_docs.configuracao_sistema</code> no Supabase.
        </p>
      </div>
    </div>
  );
}
