import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  classificado: "Classificado",
  pasta_errada: "Pasta errada",
  em_revisao: "Em revisão",
  revisado: "Revisado",
  nao_reconhecido: "Não reconhecido",
};

const statusColor: Record<string, string> = {
  pendente: "#f59e0b",
  classificado: "#16a34a",
  pasta_errada: "#ef4444",
  em_revisao: "#8b5cf6",
  revisado: "#2563eb",
  nao_reconhecido: "#6b7280",
};

export default async function EmpresaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const [empresaRes, documentosRes] = await Promise.all([
    supabase.schema("gestao_docs").from("empresa").select("nome, cnpj, codigo").eq("id", id).single(),
    supabase.schema("gestao_docs").from("documento").select("*").eq("empresa_id", id).order("detectado_em", { ascending: false }),
  ]);

  if (!empresaRes.data) notFound();

  const empresa = empresaRes.data;
  const documentos = documentosRes.data ?? [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{empresa.nome}</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>CNPJ: {empresa.cnpj} · Código: {empresa.codigo}</p>

      {!documentos.length ? (
        <p style={{ color: "#6b7280" }}>Nenhum documento detectado ainda.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th style={th}>Arquivo</th>
              <th style={th}>Tipo</th>
              <th style={th}>Mês ref.</th>
              <th style={th}>Status</th>
              <th style={th}>Detectado em</th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((d) => (
              <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{d.nome_arquivo}</td>
                <td style={td}>{d.tipo ?? "—"}</td>
                <td style={td}>{d.mes_referencia ?? "—"}</td>
                <td style={td}>
                  <span style={{ color: statusColor[d.status] ?? "#000", fontWeight: 500, fontSize: 13 }}>
                    {statusLabel[d.status] ?? d.status}
                  </span>
                </td>
                <td style={td}>{new Date(d.detectado_em).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
