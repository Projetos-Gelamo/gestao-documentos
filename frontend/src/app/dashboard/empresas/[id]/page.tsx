import Link from "next/link";
import { notFound } from "next/navigation";
import ChecklistSection from "./ChecklistSection";
import TiposEsperadosSection from "./TiposEsperadosSection";
import DocumentosTable from "./DocumentosTable";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

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
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={`/dashboard/empresas/${id}/anual`}
            style={{ padding: "9px 16px", background: "#0c1a2e", color: "#c4a030", border: "1px solid #c4a030", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            Visão anual
          </Link>
          <Link
            href={`/dashboard/empresas/${id}/upload`}
            style={{ padding: "9px 18px", background: "#c4a030", color: "#0c1a2e", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            + Enviar documento
          </Link>
        </div>
      </div>

      {/* Checklist mensal */}
      <ChecklistSection empresaId={id} />

      {/* Configuração de documentos esperados */}
      <TiposEsperadosSection empresaId={id} />

      {/* Documentos recebidos */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Documentos recebidos</h2>
        <DocumentosTable documentos={documentos} />
      </div>
    </div>
  );
}
