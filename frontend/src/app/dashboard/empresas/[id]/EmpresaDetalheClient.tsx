"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ChecklistSection from "./ChecklistSection";
import DocumentosTable from "./DocumentosTable";
import TiposEsperadosSection from "./TiposEsperadosSection";

type Empresa = { id: string; nome: string; cnpj: string; codigo: string };

export default function EmpresaDetalheClient({
  empresa,
  documentos,
}: {
  empresa: Empresa;
  documentos: any[];
}) {
  const storageKey = `anon_${empresa.id}`;
  const [anonimizado, setAnonimizado] = useState(false);

  useEffect(() => {
    try {
      setAnonimizado(localStorage.getItem(storageKey) === "1");
    } catch {}
  }, [storageKey]);

  function toggleAnon() {
    const next = !anonimizado;
    setAnonimizado(next);
    try {
      next ? localStorage.setItem(storageKey, "1") : localStorage.removeItem(storageKey);
    } catch {}
  }

  const nomeExibido = anonimizado ? `Empresa ${empresa.codigo}` : empresa.nome;
  const cnpjExibido = anonimizado ? "XX.XXX.XXX/XXXX-XX" : empresa.cnpj;

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{nomeExibido}</h1>
            <button
              onClick={toggleAnon}
              title={anonimizado ? "Exibir dados reais" : "Anonimizar dados"}
              style={{
                background: anonimizado ? "#fef3c7" : "transparent",
                border: anonimizado ? "1px solid #fde68a" : "1px solid #e5e7eb",
                borderRadius: 6,
                padding: "3px 8px",
                cursor: "pointer",
                fontSize: 13,
                color: anonimizado ? "#92400e" : "#9ca3af",
                fontWeight: anonimizado ? 600 : 400,
              }}
            >
              {anonimizado ? "🔒 Anonimizado" : "👁 Anonimizar"}
            </button>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
            CNPJ: {cnpjExibido} · Código: {empresa.codigo}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={`/dashboard/empresas/${empresa.id}/anual`}
            style={{ padding: "9px 16px", background: "#0c1a2e", color: "#c4a030", border: "1px solid #c4a030", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            Visão anual
          </Link>
          <Link
            href={`/dashboard/empresas/${empresa.id}/upload`}
            style={{ padding: "9px 18px", background: "#c4a030", color: "#0c1a2e", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            + Enviar documento
          </Link>
        </div>
      </div>

      {/* Checklist mensal */}
      <ChecklistSection empresaId={empresa.id} />

      {/* Configuração de documentos esperados */}
      <TiposEsperadosSection empresaId={empresa.id} />

      {/* Documentos recebidos */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Documentos recebidos</h2>
        <DocumentosTable documentos={documentos} anonimizado={anonimizado} />
      </div>
    </div>
  );
}
