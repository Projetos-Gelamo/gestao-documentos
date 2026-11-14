"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAnon } from "../../AnonContext";
import ChecklistSection from "./ChecklistSection";
import DocumentosTable from "./DocumentosTable";
import TiposEsperadosSection from "./TiposEsperadosSection";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

type Empresa = { id: string; nome: string; cnpj: string; codigo: string };

export default function EmpresaDetalheClient({
  empresa,
  documentos,
}: {
  empresa: Empresa;
  documentos: any[];
}) {
  const { anonimizado } = useAnon();
  const [editandoCodigo, setEditandoCodigo] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [codigoEdit, setCodigoEdit] = useState(empresa.codigo);
  const [nomeEdit, setNomeEdit] = useState(empresa.nome);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editandoCodigo || editandoNome) inputRef.current?.focus();
  }, [editandoCodigo, editandoNome]);

  async function salvarCampo(campo: "codigo" | "nome", valor: string) {
    if (!valor.trim()) return;
    setSalvando(true);
    try {
      await fetch(`${API}/empresas/${empresa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor.trim() }),
      });
    } finally {
      setSalvando(false);
      setEditandoCodigo(false);
      setEditandoNome(false);
    }
  }

  const nomeExibido = anonimizado ? `Empresa ${codigoEdit}` : nomeEdit;
  const cnpjExibido = anonimizado ? "XX.XXX.XXX/XXXX-XX" : empresa.cnpj;

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {editandoNome && !anonimizado ? (
              <input
                ref={inputRef}
                value={nomeEdit}
                onChange={(e) => setNomeEdit(e.target.value)}
                onBlur={() => salvarCampo("nome", nomeEdit)}
                onKeyDown={(e) => { if (e.key === "Enter") salvarCampo("nome", nomeEdit); if (e.key === "Escape") { setNomeEdit(empresa.nome); setEditandoNome(false); } }}
                style={{ fontSize: 22, fontWeight: 700, border: "none", borderBottom: "2px solid #c4a030", outline: "none", background: "transparent", width: 380 }}
              />
            ) : (
              <h1
                style={{ fontSize: 22, fontWeight: 700, margin: 0, cursor: anonimizado ? "default" : "text" }}
                title={anonimizado ? "" : "Clique para editar"}
                onClick={() => { if (!anonimizado) setEditandoNome(true); }}
              >
                {nomeExibido}
                {!anonimizado && <span style={{ fontSize: 13, color: "#d1d5db", marginLeft: 6 }}>✎</span>}
              </h1>
            )}
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            CNPJ: {cnpjExibido} · Código:{" "}
            {editandoCodigo && !anonimizado ? (
              <input
                ref={inputRef}
                value={codigoEdit}
                onChange={(e) => setCodigoEdit(e.target.value.toUpperCase())}
                onBlur={() => salvarCampo("codigo", codigoEdit)}
                onKeyDown={(e) => { if (e.key === "Enter") salvarCampo("codigo", codigoEdit); if (e.key === "Escape") { setCodigoEdit(empresa.codigo); setEditandoCodigo(false); } }}
                style={{ fontSize: 13, border: "none", borderBottom: "1px solid #c4a030", outline: "none", background: "transparent", width: 120, fontWeight: 600 }}
              />
            ) : (
              <span
                style={{ fontWeight: 600, cursor: anonimizado ? "default" : "pointer", borderBottom: anonimizado ? "none" : "1px dashed #d1d5db" }}
                title={anonimizado ? "" : "Clique para editar"}
                onClick={() => { if (!anonimizado) setEditandoCodigo(true); }}
              >
                {salvando ? "..." : codigoEdit}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={`/dashboard/empresas/${empresa.id}/plano-contas`}
            style={{ padding: "9px 14px", background: "transparent", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, textDecoration: "none" }}
          >
            Plano de Contas
          </Link>
          <Link
            href={`/dashboard/empresas/${empresa.id}/lancamentos`}
            style={{ padding: "9px 14px", background: "transparent", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, textDecoration: "none" }}
          >
            Lançamentos
          </Link>
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
