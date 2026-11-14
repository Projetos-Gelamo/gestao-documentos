"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

const TODOS_TIPOS_DOC = [
  { value: "extrato_bancario", label: "Extrato Bancário" },
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "folha_pagamento", label: "Folha de Pagamento" },
  { value: "guia_pagamento", label: "Guia de Pagamento" },
  { value: "comprovante_pagamento", label: "Comprovante de Pagamento" },
  { value: "contrato_emprestimo", label: "Contrato de Empréstimo" },
  { value: "contrato", label: "Contrato" },
  { value: "planilha_financeira", label: "Planilha Financeira" },
  { value: "dre", label: "DRE" },
  { value: "balancete", label: "Balancete" },
  { value: "recibo", label: "Recibo" },
  { value: "outros", label: "Outros" },
];

const TIPOS_BY_DEPT: Record<string, string[]> = {
  contabil: ["extrato_bancario", "balancete", "dre", "planilha_financeira", "guia_pagamento", "comprovante_pagamento", "contrato_emprestimo"],
  fiscal:   ["nota_fiscal"],
  dp:       ["folha_pagamento", "recibo"],
  legal:    ["contrato"],
  outros:   ["outros"],
};

type Tipo = {
  id: string;
  tipo: string;
  banco: string | null;
  conta: string | null;
  agencia: string | null;
  descricao: string | null;
};

type AutoPreviewItem = {
  tipo: string;
  banco: string | null;
  conta: string | null;
  periodicidade: string;
};

export default function TiposEsperadosSection({ empresaId, departamento }: { empresaId: string; departamento?: string }) {
  const allowedTipos = departamento ? (TIPOS_BY_DEPT[departamento] ?? []) : TODOS_TIPOS_DOC.map((t) => t.value);
  const TIPOS_DOC = TODOS_TIPOS_DOC.filter((t) => allowedTipos.includes(t.value));
  const [todos, setTodos] = useState<Tipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ tipo: allowedTipos[0] ?? "extrato_bancario", banco: "", conta: "", agencia: "", descricao: "" });

  const tipos = departamento
    ? todos.filter((t) => allowedTipos.includes(t.tipo))
    : todos;
  const [autoPreview, setAutoPreview] = useState<AutoPreviewItem[] | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoConfirming, setAutoConfirming] = useState(false);

  useEffect(() => {
    fetch(`${API}/empresas/${empresaId}/tipos-esperados`)
      .then((r) => r.json())
      .then(setTodos)
      .finally(() => setLoading(false));
  }, [empresaId]);

  async function handleAdd() {
    setAdding(true);
    const body = {
      empresa_id: empresaId,
      tipo: form.tipo,
      banco: form.banco || null,
      conta: form.conta || null,
      agencia: form.agencia || null,
      descricao: form.descricao || null,
      periodicidade: "mensal",
    };
    const res = await fetch(`${API}/empresas/${empresaId}/tipos-esperados`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const novo = await res.json();
      setTodos((prev) => [...prev, novo]);
      setForm({ tipo: allowedTipos[0] ?? "extrato_bancario", banco: "", conta: "", agencia: "", descricao: "" });
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    await fetch(`${API}/tipos-esperados/${id}`, { method: "DELETE" });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleAutoPreview() {
    setAutoLoading(true);
    setAutoPreview(null);
    try {
      const res = await fetch(`${API}/empresas/${empresaId}/configuracao-automatica?dry_run=true`, { method: "POST" });
      const data = res.ok ? await res.json() : { preview: [] };
      setAutoPreview(data.preview ?? []);
    } catch (err) {
      console.error("Erro ao gerar preview:", err);
      setAutoPreview([]);
    } finally {
      setAutoLoading(false);
    }
  }

  async function handleAutoConfirm() {
    setAutoConfirming(true);
    try {
      const res = await fetch(`${API}/empresas/${empresaId}/configuracao-automatica?dry_run=false`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const criados: Tipo[] = (data.preview ?? []).map((item: any) => ({
          id: item.id ?? String(Math.random()),
          tipo: item.tipo,
          banco: item.banco ?? null,
          conta: item.conta ?? null,
          agencia: null,
          descricao: null,
        }));
        setTodos((prev) => [...prev, ...criados]);
        setAutoPreview(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao salvar configuração: ${err.detail ?? `HTTP ${res.status}`}. Tente novamente.`);
      }
    } catch (err) {
      console.error("Erro ao confirmar configuração automática:", err);
      alert("Erro de conexão ao salvar. Tente novamente.");
    } finally {
      setAutoConfirming(false);
    }
  }

  const tipoLabel = (val: string) => TIPOS_DOC.find((t) => t.value === val)?.label ?? val;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Documentos esperados mensalmente</h2>
        {(!departamento || departamento === "contabil") && (
          <button
            onClick={handleAutoPreview}
            disabled={autoLoading}
            style={{ padding: "6px 14px", background: "#c4a030", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: autoLoading ? 0.7 : 1 }}
          >
            {autoLoading ? "Analisando..." : "✨ Gerar automaticamente"}
          </button>
        )}
      </div>

      {autoPreview !== null && (
        <div style={{ marginBottom: 16, padding: 16, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#92400e" }}>
            {autoPreview.length === 0
              ? "✓ Nenhum tipo novo encontrado. Todos já estão configurados ou não há documentos classificados."
              : `${autoPreview.length} tipo(s) encontrado(s) nos documentos classificados:`}
          </p>
          {autoPreview.length > 0 && (
            <>
              <ul style={{ margin: "0 0 12px 0", padding: "0 0 0 16px", fontSize: 13 }}>
                {autoPreview.map((item, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <strong>{tipoLabel(item.tipo)}</strong>
                    {item.banco && <span style={{ color: "#6b7280" }}> — {item.banco}</span>}
                    {item.conta && <span style={{ color: "#6b7280" }}> CC {item.conta}</span>}
                    <span style={{ color: "#9ca3af" }}> (mensal)</span>
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleAutoConfirm}
                  disabled={autoConfirming}
                  style={{ padding: "6px 14px", background: "#16a34a", color: "white", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  {autoConfirming ? "Salvando..." : "Confirmar e salvar"}
                </button>
                <button
                  onClick={() => setAutoPreview(null)}
                  style={{ padding: "6px 14px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
          {autoPreview.length === 0 && (
            <button
              onClick={() => setAutoPreview(null)}
              style={{ padding: "5px 12px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}
            >
              OK
            </button>
          )}
        </div>
      )}
      {loading ? (
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Carregando...</p>
      ) : tipos.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Nenhum configurado ainda.</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {tipos.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "white", borderRadius: 6, marginBottom: 6, fontSize: 13, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
              <span>
                <strong>{tipoLabel(t.tipo)}</strong>
                {t.banco && <span style={{ color: "#6b7280" }}> — {t.banco}</span>}
                {t.conta && <span style={{ color: "#6b7280" }}> CC {t.conta}</span>}
                {t.descricao && <span style={{ color: "#9ca3af" }}> ({t.descricao})</span>}
              </span>
              <button onClick={() => handleDelete(t.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Formulário de adição */}
      <details>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#2563eb", fontWeight: 500 }}>+ Adicionar documento esperado</summary>
        <div style={{ marginTop: 12, padding: 16, background: "#f9fafb", borderRadius: 8, display: "grid", gap: 10 }}>
          <div>
            <label style={labelStyle}>Tipo de documento</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
              {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {form.tipo === "extrato_bancario" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Banco</label>
                  <input placeholder="Ex: Itaú" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Conta corrente</label>
                  <input placeholder="Ex: 12345-6" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </>
          )}
          <div>
            <label style={labelStyle}>Descrição (opcional)</label>
            <input placeholder="Ex: Conta salários" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={inputStyle} />
          </div>
          <button onClick={handleAdd} disabled={adding} style={{ padding: "8px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", width: "fit-content" }}>
            {adding ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </details>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, background: "white", boxSizing: "border-box" };
