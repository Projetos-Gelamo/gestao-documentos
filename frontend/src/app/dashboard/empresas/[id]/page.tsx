import Link from "next/link";
import { notFound } from "next/navigation";
import ChecklistSection from "./ChecklistSection";
import TiposEsperadosSection from "./TiposEsperadosSection";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

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

  const [empresaRes, documentosRes] = await Promise.all([
    fetch(`${API}/empresas/${id}`, { cache: "no-store" }),
    fetch(`${API}/documentos/?empresa_id=${id}`, { cache: "no-store" }),
  ]);

  if (!empresaRes.ok) notFound();

  const empresa = await empresaRes.json();
  const documentos: any[] = documentosRes.ok ? await documentosRes.json() : [];

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{empresa.nome}</h1>
          <p style={{ color: "#6b7280", fontSize: 13 }}>CNPJ: {empresa.cnpj} · Código: {empresa.codigo}</p>
        </div>
        <Link
          href={`/dashboard/empresas/${id}/upload`}
          style={{
            padding: "9px 18px",
            background: "#2563eb",
            color: "white",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          + Enviar documento
        </Link>
      </div>

      {/* Checklist mensal */}
      <ChecklistSection empresaId={id} />

      {/* Configuração de documentos esperados */}
      <TiposEsperadosSection empresaId={id} />

      {/* Documentos recebidos */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Documentos recebidos</h2>
        {!documentos.length ? (
          <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum documento detectado ainda.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={th}>Arquivo</th>
                <th style={th}>Tipo</th>
                <th style={th}>Mês ref.</th>
                <th style={th}>Banco / Conta</th>
                <th style={th}>Status</th>
                <th style={th}>Recebido em</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>{d.nome_arquivo}</td>
                  <td style={td}>{d.tipo ?? "—"}</td>
                  <td style={td}>{d.mes_referencia ?? "—"}</td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>
                    {d.banco ? `${d.banco}${d.conta ? ` CC ${d.conta}` : ""}` : "—"}
                  </td>
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
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
