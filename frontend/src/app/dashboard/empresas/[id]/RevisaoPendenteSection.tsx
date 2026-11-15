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

const TODOS_TIPOS_DOC = Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }));

type DocPendente = {
  id: string;
  nome_arquivo: string;
  tipo: string | null;
  status: string;
  banco: string | null;
  conta: string | null;
  mes_referencia: string | null;
  cnpj_extraido: string | null;
  detectado_em: string;
};

type AcaoState = {
  [docId: string]: {
    emAndamento: string | null;
    finalizada: string | null;
    classificandoManual: boolean;
    manualForm: { tipo: string; mes_referencia: string; banco: string; conta: string };
  };
};

export default function RevisaoPendenteSection({ empresaId }: { empresaId: string }) {
  const [docs, setDocs] = useState<DocPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [acoes, setAcoes] = useState<AcaoState>({});

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/empresas/${empresaId}/revisao-pendente`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setDocs(data);
        const init: AcaoState = {};
        for (const d of data) {
          init[d.id] = {
            emAndamento: null,
            finalizada: null,
            classificandoManual: false,
            manualForm: { tipo: "extrato_bancario", mes_referencia: "", banco: "", conta: "" },
          };
        }
        setAcoes(init);
      })
      .finally(() => setLoading(false));
  }, [empresaId]);

  const pendentes = docs.filter((d) => !acoes[d.id]?.finalizada);

  if (loading) return null;
  if (!docs.length) return null;

  function setAcao(id: string, patch: Partial<AcaoState[string]>) {
    setAcoes((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function logAcao(docId: string, tipo_acao: string, detalhes?: object) {
    try {
      await fetch(`${API}/acoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, documento_id: docId, tipo_acao, detalhes }),
      });
    } catch {}
  }

  async function handleExcluir(doc: DocPendente) {
    setAcao(doc.id, { emAndamento: "excluir" });
    try {
      const r = await fetch(`${API}/documentos/${doc.id}`, { method: "DELETE" });
      if (r.ok) {
        await logAcao(doc.id, "excluir_revisao");
        setAcao(doc.id, { finalizada: "Excluído", emAndamento: null });
      }
    } catch {
      setAcao(doc.id, { emAndamento: null });
    }
  }

  async function handleMoverEmpresa(doc: DocPendente) {
    if (!doc.cnpj_extraido) {
      alert("CNPJ não disponível neste documento para localizar a empresa destino.");
      return;
    }
    const normaliza = (c: string) => c.replace(/\D/g, "");
    const cnpjDoc = normaliza(doc.cnpj_extraido);
    setAcao(doc.id, { emAndamento: "mover" });
    try {
      const r = await fetch(`${API}/empresas`);
      const empresas = r.ok ? await r.json() : [];
      const dest = empresas.find((e: any) => normaliza(e.cnpj || "") === cnpjDoc);
      if (!dest) {
        alert(`Empresa com CNPJ ${doc.cnpj_extraido} não encontrada no sistema.`);
        setAcao(doc.id, { emAndamento: null });
        return;
      }
      const mr = await fetch(`${API}/documentos/${doc.id}/mover-empresa/${dest.id}`, { method: "POST" });
      if (mr.ok) {
        await logAcao(doc.id, "mover_empresa", { empresa_destino_id: dest.id });
        setAcao(doc.id, { finalizada: `Movido → ${dest.nome}`, emAndamento: null });
      }
    } catch {
      setAcao(doc.id, { emAndamento: null });
    }
  }

  async function handleClassificarManual(doc: DocPendente) {
    const a = acoes[doc.id];
    if (!a?.manualForm.tipo || !a?.manualForm.mes_referencia) {
      alert("Preencha tipo e mês de referência.");
      return;
    }
    setAcao(doc.id, { emAndamento: "classificar" });
    try {
      const body = {
        tipo: a.manualForm.tipo,
        mes_referencia: a.manualForm.mes_referencia,
        banco: a.manualForm.banco || null,
        conta: a.manualForm.conta || null,
      };
      const r = await fetch(`${API}/documentos/${doc.id}/classificar-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        await logAcao(doc.id, "classificar_manual", body);
        setAcao(doc.id, { finalizada: "Classificado manualmente", emAndamento: null, classificandoManual: false });
      }
    } catch {
      setAcao(doc.id, { emAndamento: null });
    }
  }

  const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
    nao_reconhecido: { label: "Não identificado", color: "#d97706", bg: "#fefce8" },
    empresa_errada:  { label: "Empresa errada",  color: "#b91c1c", bg: "#fef2f2" },
    duplicata:       { label: "Duplicata",        color: "#c2410c", bg: "#fff7ed" },
  };

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Revisão pendente</h2>
        {pendentes.length > 0 && (
          <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", borderRadius: 10, padding: "2px 8px", fontWeight: 700 }}>
            {pendentes.length}
          </span>
        )}
      </div>

      {pendentes.length === 0 ? (
        <p style={{ fontSize: 13, color: "#16a34a" }}>✓ Nenhum documento aguardando revisão.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((doc) => {
            const a = acoes[doc.id];
            const cfg = statusLabel[doc.status] ?? { label: doc.status, color: "#6b7280", bg: "#f9fafb" };
            if (a?.finalizada) return null;

            return (
              <div key={doc.id} style={{ background: cfg.bg, border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: "white", border: `1px solid ${cfg.color}`, borderRadius: 4, padding: "1px 7px" }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{doc.nome_arquivo}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", fontSize: 12, color: "#6b7280" }}>
                      {doc.tipo && <span>Tipo: {TIPO_LABEL[doc.tipo] ?? doc.tipo}</span>}
                      {doc.banco && <span>Banco: {doc.banco}</span>}
                      {doc.conta && <span>CC: {doc.conta}</span>}
                      {doc.mes_referencia && <span>Mês: {doc.mes_referencia}</span>}
                      {doc.cnpj_extraido && <span>CNPJ doc: {doc.cnpj_extraido}</span>}
                      <span>Recebido em: {new Date(doc.detectado_em).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div style={{ marginTop: 10 }}>
                  {doc.status === "nao_reconhecido" && !a?.classificandoManual && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <AcaoBtn onClick={() => setAcao(doc.id, { classificandoManual: true })} loading={false} label="✏ Classificar agora" color="#d97706" />
                      <AcaoBtn onClick={() => handleExcluir(doc)} loading={a?.emAndamento === "excluir"} label="✕ Excluir" color="#b91c1c" />
                    </div>
                  )}
                  {doc.status === "nao_reconhecido" && a?.classificandoManual && (
                    <ClassificacaoForm
                      form={a.manualForm}
                      onChange={(f) => setAcao(doc.id, { manualForm: f })}
                      onSubmit={() => handleClassificarManual(doc)}
                      onCancel={() => setAcao(doc.id, { classificandoManual: false })}
                      loading={a.emAndamento === "classificar"}
                    />
                  )}
                  {doc.status === "empresa_errada" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <AcaoBtn onClick={() => handleMoverEmpresa(doc)} loading={a?.emAndamento === "mover"} label="→ Mover para empresa certa" color="#2563eb" />
                      <AcaoBtn onClick={() => handleExcluir(doc)} loading={a?.emAndamento === "excluir"} label="✕ Excluir" color="#b91c1c" />
                    </div>
                  )}
                  {doc.status === "duplicata" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <AcaoBtn onClick={() => handleExcluir(doc)} loading={a?.emAndamento === "excluir"} label="✕ Excluir duplicata" color="#b91c1c" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AcaoBtn({ onClick, loading, label, color }: { onClick: () => void; loading: boolean; label: string; color: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: "5px 12px",
        background: "white",
        color,
        border: `1px solid ${color}`,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Aguarde..." : label}
    </button>
  );
}

function ClassificacaoForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  loading,
}: {
  form: { tipo: string; mes_referencia: string; banco: string; conta: string };
  onChange: (f: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div style={{ padding: 12, background: "white", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={lbl}>Tipo</label>
          <select value={form.tipo} onChange={(e) => onChange({ ...form, tipo: e.target.value })} style={inp}>
            {TODOS_TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Mês referência (YYYY-MM)</label>
          <input
            placeholder="Ex: 2025-01"
            value={form.mes_referencia}
            onChange={(e) => onChange({ ...form, mes_referencia: e.target.value })}
            style={inp}
          />
        </div>
        {form.tipo === "extrato_bancario" && (
          <>
            <div>
              <label style={lbl}>Banco (opcional)</label>
              <input placeholder="Ex: Itaú" value={form.banco} onChange={(e) => onChange({ ...form, banco: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={lbl}>Conta (opcional)</label>
              <input placeholder="Ex: 12345-6" value={form.conta} onChange={(e) => onChange({ ...form, conta: e.target.value })} style={inp} />
            </div>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onSubmit}
          disabled={loading}
          style={{ padding: "6px 14px", background: "#0c1a2e", color: "#c4a030", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Salvando..." : "Salvar classificação"}
        </button>
        <button onClick={onCancel} style={{ padding: "6px 12px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#6b7280", marginBottom: 3, fontWeight: 500 };
const inp: React.CSSProperties = { width: "100%", padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 12, background: "white", boxSizing: "border-box" };
