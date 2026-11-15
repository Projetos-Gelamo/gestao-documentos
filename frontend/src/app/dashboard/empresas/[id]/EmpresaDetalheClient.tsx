"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAnon } from "../../AnonContext";
import ChecklistSection from "./ChecklistSection";
import DocumentosTable from "./DocumentosTable";
import TiposEsperadosSection from "./TiposEsperadosSection";
import RevisaoPendenteSection from "./RevisaoPendenteSection";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

type Departamento = "contabil" | "dp" | "legal" | "fiscal";
type SubAbaContabil = "visao" | "enviar" | "automatizacao";

const ABAS: { key: Departamento; label: string }[] = [
  { key: "contabil", label: "Contábil" },
  { key: "dp",       label: "Dep. Pessoal" },
  { key: "legal",    label: "Legal" },
  { key: "fiscal",   label: "Escrita Fiscal" },
];

const SUB_ABAS_CONTABIL: { key: SubAbaContabil; label: string; icon: string }[] = [
  { key: "visao",         label: "Visão anual",        icon: "📋" },
  { key: "enviar",        label: "Enviar documentos",  icon: "📤" },
  { key: "automatizacao", label: "Automatização",      icon: "✦" },
];

type Empresa = { id: string; nome: string; cnpj: string; codigo: string; matriz_id?: string | null };

export default function EmpresaDetalheClient({
  empresa,
  documentos,
  filiais = [],
}: {
  empresa: Empresa;
  documentos: any[];
  filiais?: Empresa[];
}) {
  const { anonimizado } = useAnon();

  const [editandoCodigo, setEditandoCodigo] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [codigoEdit, setCodigoEdit] = useState(empresa.codigo);
  const [nomeEdit, setNomeEdit] = useState(empresa.nome);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [aba, setAba] = useState<Departamento>("contabil");
  const [subAba, setSubAba] = useState<SubAbaContabil>("visao");

  const [entidadeId, setEntidadeId] = useState(empresa.id);
  const [entidadeDocs, setEntidadeDocs] = useState<any[]>(documentos);
  const [carregandoDocs, setCarregandoDocs] = useState(false);

  const entidadeAtual: Empresa =
    entidadeId === empresa.id
      ? empresa
      : filiais.find((f) => f.id === entidadeId) ?? empresa;

  useEffect(() => {
    if (editandoCodigo || editandoNome) inputRef.current?.focus();
  }, [editandoCodigo, editandoNome]);

  async function trocarEntidade(id: string) {
    if (id === entidadeId) return;
    setEntidadeId(id);
    setCarregandoDocs(true);
    try {
      const res = await fetch(`${API}/documentos/?empresa_id=${id}`, { cache: "no-store" } as any);
      setEntidadeDocs(res.ok ? await res.json() : []);
    } finally {
      setCarregandoDocs(false);
    }
  }

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

  function countDept(dept: Departamento) {
    return entidadeDocs.filter(
      (d) => !d.excluido_em && (d.departamento ?? "outros") === dept
    ).length;
  }

  const temFiliais = filiais.length > 0;

  return (
    <div>
      {/* Cabeçalho — nome à esquerda, seletor Matriz/Filial à direita */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
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

        {/* Seletor Matriz / Filial — canto superior direito */}
        {temFiliais && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Visualizando:</span>
            {[empresa, ...filiais].map((e) => {
              const selecionado = entidadeId === e.id;
              const isFilial = e.id !== empresa.id;
              return (
                <button
                  key={e.id}
                  onClick={() => trocarEntidade(e.id)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 20,
                    border: `1px solid ${selecionado ? "#c4a030" : "#d1d5db"}`,
                    background: selecionado ? "#fef9ec" : "white",
                    color: selecionado ? "#92400e" : "#374151",
                    fontWeight: selecionado ? 700 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {isFilial && <span style={{ fontSize: 10, color: "#6b7280" }}>↳</span>}
                  {anonimizado ? `Empresa ${e.codigo}` : (isFilial ? `Filial — ${e.codigo}` : "Matriz")}
                  {selecionado && <span style={{ fontSize: 10 }}>●</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Abas por departamento */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb" }}>
          {ABAS.map(({ key, label }) => {
            const count = countDept(key);
            const ativa = aba === key;
            return (
              <button
                key={key}
                onClick={() => setAba(key)}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: ativa ? 700 : 500,
                  color: ativa ? "#c4a030" : "#6b7280",
                  background: ativa ? "#ffffff" : "transparent",
                  border: "none",
                  borderBottom: ativa ? "2px solid #c4a030" : "2px solid transparent",
                  marginBottom: -2,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{
                    fontSize: 11, background: ativa ? "#fef3c7" : "#f3f4f6",
                    color: ativa ? "#92400e" : "#9ca3af",
                    borderRadius: 10, padding: "1px 7px", fontWeight: 600,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderTop: "none",
          borderRadius: "0 0 10px 10px",
          opacity: carregandoDocs ? 0.6 : 1,
          transition: "opacity 0.2s",
        }}>

          {/* Sub-abas — apenas na aba Contábil */}
          {aba === "contabil" && (
            <div style={{
              display: "flex",
              gap: 8,
              padding: "16px 24px",
              borderBottom: "1px solid #e5e7eb",
              marginBottom: 0,
              background: "#fafafa",
              flexWrap: "wrap",
            }}>
              {SUB_ABAS_CONTABIL.map(({ key, label, icon }) => {
                const ativa = subAba === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSubAba(key)}
                    style={{
                      padding: "7px 16px",
                      fontSize: 13,
                      fontWeight: ativa ? 700 : 500,
                      color: ativa ? "#c4a030" : "#374151",
                      background: ativa ? "#0c1a2e" : "white",
                      border: `1px solid ${ativa ? "#c4a030" : "#d1d5db"}`,
                      borderRadius: 6,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all .15s",
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ padding: 24 }}>

            {/* ── Contábil → Visão anual ── */}
            {aba === "contabil" && subAba === "visao" && (
              <div>
                <ChecklistSection empresaId={entidadeId} />
                <div style={{ marginTop: 28 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                      Documentos recebidos
                      {carregandoDocs && <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8, fontWeight: 400 }}>Carregando...</span>}
                    </h2>
                    <Link
                      href={`/dashboard/empresas/${entidadeId}/anual`}
                      style={{ padding: "7px 14px", background: "#0c1a2e", color: "#c4a030", border: "1px solid #c4a030", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                    >
                      Ver visão anual completa →
                    </Link>
                  </div>
                  <DocumentosTable documentos={entidadeDocs} anonimizado={anonimizado} departamento={aba} />
                </div>
              </div>
            )}

            {/* ── Contábil → Enviar documentos ── */}
            {aba === "contabil" && subAba === "enviar" && (
              <div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                  <Link
                    href={`/dashboard/empresas/${entidadeId}/upload`}
                    style={{ padding: "9px 18px", background: "#c4a030", color: "#0c1a2e", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
                  >
                    + Enviar documento
                  </Link>
                </div>
                <TiposEsperadosSection
                  empresaId={entidadeId}
                  departamento="contabil"
                  filiais={entidadeId === empresa.id ? filiais.map((f) => ({ id: f.id, codigo: f.codigo, nome: f.nome })) : []}
                  hideAutoGenerate
                />
                <RevisaoPendenteSection empresaId={entidadeId} />
              </div>
            )}

            {/* ── Contábil → Automatização ── */}
            {aba === "contabil" && subAba === "automatizacao" && (
              <div>
                <div style={{
                  padding: 28,
                  background: "linear-gradient(135deg, #0c1a2e 0%, #1a2e48 100%)",
                  borderRadius: 10,
                }}>
                  <p style={{ color: "#c4a030", fontWeight: 700, fontSize: 17, margin: 0, marginBottom: 8 }}>
                    ✦ Automatização Contábil
                  </p>
                  <p style={{ color: "#8a9ab8", fontSize: 13, margin: 0, marginBottom: 28 }}>
                    Plano de contas, razões, balancetes e geração de lançamentos por IA para importação no Domínio
                  </p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Link
                      href={`/dashboard/empresas/${entidadeId}/plano-contas`}
                      style={{
                        padding: "11px 24px", background: "rgba(196,160,48,0.12)", color: "#c4a030",
                        border: "1px solid rgba(196,160,48,0.4)", borderRadius: 8,
                        fontSize: 14, fontWeight: 600, textDecoration: "none",
                      }}
                    >
                      Plano de Contas
                    </Link>
                    <Link
                      href={`/dashboard/empresas/${entidadeId}/razoes`}
                      style={{
                        padding: "11px 24px", background: "rgba(196,160,48,0.12)", color: "#c4a030",
                        border: "1px solid rgba(196,160,48,0.4)", borderRadius: 8,
                        fontSize: 14, fontWeight: 600, textDecoration: "none",
                      }}
                    >
                      Razões
                    </Link>
                    <Link
                      href={`/dashboard/empresas/${entidadeId}/balancetes`}
                      style={{
                        padding: "11px 24px", background: "rgba(196,160,48,0.12)", color: "#c4a030",
                        border: "1px solid rgba(196,160,48,0.4)", borderRadius: 8,
                        fontSize: 14, fontWeight: 600, textDecoration: "none",
                      }}
                    >
                      Balancetes
                    </Link>
                    <Link
                      href={`/dashboard/empresas/${entidadeId}/lancamentos`}
                      style={{
                        padding: "11px 24px", background: "#c4a030", color: "#0c1a2e",
                        borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none",
                      }}
                    >
                      Gerar Lançamentos
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ── Dep. Pessoal / Legal / Fiscal ── */}
            {aba !== "contabil" && (
              <div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                  <Link
                    href={`/dashboard/empresas/${entidadeId}/upload`}
                    style={{ padding: "9px 18px", background: "#c4a030", color: "#0c1a2e", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
                  >
                    + Enviar documento
                  </Link>
                </div>
                <TiposEsperadosSection
                  empresaId={entidadeId}
                  departamento={aba}
                  filiais={[]}
                />
                <div style={{ marginTop: 28 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                    Documentos recebidos
                    {carregandoDocs && <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8, fontWeight: 400 }}>Carregando...</span>}
                  </h2>
                  <DocumentosTable documentos={entidadeDocs} anonimizado={anonimizado} departamento={aba} />
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
