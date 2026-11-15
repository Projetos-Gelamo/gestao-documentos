"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

const TIPO_LABEL: Record<string, string> = {
  extrato_bancario: "Extrato Bancário",
  nota_fiscal: "Nota Fiscal",
  guia_pagamento: "Guia de Pagamento",
  contrato: "Contrato",
  recibo: "Recibo",
  balancete: "Balancete",
  dre: "DRE",
  folha_pagamento: "Folha de Pagamento",
  comprovante_pagamento: "Comprovante de Pagamento",
  contrato_emprestimo: "Contrato de Empréstimo",
  planilha_financeira: "Planilha Financeira",
  outros: "Outros",
};

type DocFila = {
  id: string;
  nome_arquivo: string;
  tipo: string | null;
  banco: string | null;
  conta: string | null;
  mes_referencia: string | null;
  cnpj_extraido: string | null;
  detectado_em: string;
  empresa: { id: string; nome: string; codigo: string } | null;
};

type Empresa = { id: string; nome: string; codigo: string; cnpj: string | null };

type AcaoState = {
  emAndamento: string | null;
  finalizada: string | null;
  escolhendoEmpresa: boolean;
  empresaDestId: string;
};

export default function FilaGlobalPage() {
  const [docs, setDocs] = useState<DocFila[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [acoes, setAcoes] = useState<Record<string, AcaoState>>({});

  useEffect(() => {
    Promise.all([
      fetch(`${API}/fila-global`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API}/empresas`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([docsData, empresasData]) => {
      setDocs(docsData);
      setEmpresas(empresasData);
      const init: Record<string, AcaoState> = {};
      for (const d of docsData) {
        init[d.id] = { emAndamento: null, finalizada: null, escolhendoEmpresa: false, empresaDestId: "" };
      }
      setAcoes(init);
    }).finally(() => setLoading(false));
  }, []);

  const pendentes = docs.filter((d) => !acoes[d.id]?.finalizada);

  function setAcao(id: string, patch: Partial<AcaoState>) {
    setAcoes((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleMover(doc: DocFila) {
    const a = acoes[doc.id];
    if (!a?.empresaDestId) {
      alert("Selecione a empresa destino.");
      return;
    }
    setAcao(doc.id, { emAndamento: "mover" });
    try {
      const r = await fetch(`${API}/documentos/${doc.id}/mover-empresa/${a.empresaDestId}`, { method: "POST" });
      if (r.ok) {
        const dest = empresas.find((e) => e.id === a.empresaDestId);
        setAcao(doc.id, { finalizada: `Movido → ${dest?.nome ?? a.empresaDestId}`, emAndamento: null });
      } else {
        alert("Erro ao mover. Tente novamente.");
        setAcao(doc.id, { emAndamento: null });
      }
    } catch {
      setAcao(doc.id, { emAndamento: null });
    }
  }

  async function handleMoverPeloCnpj(doc: DocFila) {
    if (!doc.cnpj_extraido) return;
    const cnpjNorm = (c: string) => c.replace(/\D/g, "");
    const cnpjDoc = cnpjNorm(doc.cnpj_extraido);
    const dest = empresas.find((e) => cnpjNorm(e.cnpj || "") === cnpjDoc);
    if (!dest) {
      alert(`Empresa com CNPJ ${doc.cnpj_extraido} não encontrada no sistema.`);
      return;
    }
    setAcao(doc.id, { emAndamento: "mover" });
    try {
      const r = await fetch(`${API}/documentos/${doc.id}/mover-empresa/${dest.id}`, { method: "POST" });
      if (r.ok) {
        setAcao(doc.id, { finalizada: `Movido → ${dest.nome}`, emAndamento: null });
      } else {
        setAcao(doc.id, { emAndamento: null });
      }
    } catch {
      setAcao(doc.id, { emAndamento: null });
    }
  }

  async function handleExcluir(doc: DocFila) {
    if (!confirm(`Excluir "${doc.nome_arquivo}"? Esta ação não pode ser desfeita.`)) return;
    setAcao(doc.id, { emAndamento: "excluir" });
    try {
      const r = await fetch(`${API}/documentos/${doc.id}`, { method: "DELETE" });
      if (r.ok) {
        setAcao(doc.id, { finalizada: "Excluído", emAndamento: null });
      } else {
        setAcao(doc.id, { emAndamento: null });
      }
    } catch {
      setAcao(doc.id, { emAndamento: null });
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "40px 32px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0c1a2e" }}>Fila Global</h1>
        <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>Carregando…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 32px", maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0c1a2e" }}>Fila Global</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
          Arquivos que não foram vinculados a nenhuma empresa durante o envio. Mova para a empresa certa ou exclua.
        </p>
      </div>

      {pendentes.length === 0 ? (
        <div style={{ padding: 32, background: "#f0fdf4", borderRadius: 10, textAlign: "center" }}>
          <p style={{ fontSize: 20, marginBottom: 8 }}>✓</p>
          <p style={{ fontSize: 14, color: "#16a34a", fontWeight: 600 }}>Fila global vazia</p>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Todos os arquivos foram roteados.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              {pendentes.length} arquivo{pendentes.length !== 1 ? "s" : ""} aguardando destino
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {docs.map((doc) => {
              const a = acoes[doc.id];
              if (a?.finalizada) return null;

              const cnpjNorm = (c: string) => c.replace(/\D/g, "");
              const empresaAutoMatch = doc.cnpj_extraido
                ? empresas.find((e) => cnpjNorm(e.cnpj || "") === cnpjNorm(doc.cnpj_extraido!))
                : null;

              return (
                <div key={doc.id} style={{ padding: "14px 16px", background: "#faf5ff", border: "1px solid #ddd6fe", borderRadius: 10 }}>
                  {/* Cabeçalho do card */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.nome_arquivo}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", fontSize: 11, color: "#6b7280" }}>
                        {doc.tipo && <span>Tipo: {TIPO_LABEL[doc.tipo] ?? doc.tipo}</span>}
                        {doc.banco && <span>Banco: {doc.banco}</span>}
                        {doc.conta && <span>CC: {doc.conta}</span>}
                        {doc.mes_referencia && <span>Mês: {doc.mes_referencia}</span>}
                        {doc.cnpj_extraido && <span>CNPJ doc: {_formatCnpj(doc.cnpj_extraido)}</span>}
                        {doc.empresa && <span style={{ color: "#7c3aed" }}>Origem: {doc.empresa.nome}</span>}
                        <span>Recebido: {new Date(doc.detectado_em).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Botão de mover automático pelo CNPJ */}
                    {empresaAutoMatch && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, fontSize: 12 }}>
                        <span style={{ flex: 1, color: "#1e40af" }}>
                          Empresa identificada pelo CNPJ: <strong>{empresaAutoMatch.nome}</strong>
                        </span>
                        <Btn onClick={() => handleMoverPeloCnpj(doc)} loading={a?.emAndamento === "mover"} label={`→ Mover para ${empresaAutoMatch.nome}`} color="#2563eb" />
                      </div>
                    )}

                    {/* Mover para empresa específica */}
                    {!a?.escolhendoEmpresa ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Btn onClick={() => setAcao(doc.id, { escolhendoEmpresa: true })} loading={false} label="🏢 Escolher empresa" color="#7c3aed" />
                        <Btn onClick={() => handleExcluir(doc)} loading={a?.emAndamento === "excluir"} label="✕ Excluir" color="#b91c1c" />
                      </div>
                    ) : (
                      <div style={{ padding: "10px 12px", background: "white", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Empresa destino:</label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select
                            value={a.empresaDestId}
                            onChange={(e) => setAcao(doc.id, { empresaDestId: e.target.value })}
                            style={{ flex: 1, padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 12, background: "white" }}
                          >
                            <option value="">— Selecionar empresa —</option>
                            {empresas.map((e) => (
                              <option key={e.id} value={e.id}>{e.nome} ({e.codigo})</option>
                            ))}
                          </select>
                          <Btn onClick={() => handleMover(doc)} loading={a?.emAndamento === "mover"} label="Mover" color="#7c3aed" />
                          <button onClick={() => setAcao(doc.id, { escolhendoEmpresa: false, empresaDestId: "" })}
                            style={{ padding: "5px 10px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Itens finalizados */}
      {docs.some((d) => acoes[d.id]?.finalizada) && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Concluídos nesta sessão:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {docs.filter((d) => acoes[d.id]?.finalizada).map((doc) => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12 }}>
                <span style={{ color: "#16a34a" }}>✓</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>{doc.nome_arquivo}</span>
                <span style={{ color: "#16a34a", fontWeight: 600 }}>{acoes[doc.id]?.finalizada}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, loading, label, color }: { onClick: () => void; loading: boolean; label: string; color: string }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{
        padding: "5px 12px", background: "white", color, border: `1px solid ${color}`,
        borderRadius: 6, fontSize: 12, fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
      }}>
      {loading ? "Aguarde…" : label}
    </button>
  );
}

function _formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
