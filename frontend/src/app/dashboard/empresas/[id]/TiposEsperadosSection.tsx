"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

const TIPOS_DOC = [
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

type Tipo = {
  id: string;
  tipo: string;
  banco: string | null;
  conta: string | null;
  agencia: string | null;
  descricao: string | null;
};

export default function TiposEsperadosSection({ empresaId }: { empresaId: string }) {
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ tipo: "extrato_bancario", banco: "", conta: "", agencia: "", descricao: "" });

  useEffect(() => {
    fetch(`${API}/empresas/${empresaId}/tipos-esperados`)
      .then((r) => r.json())
      .then(setTipos)
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
      setTipos((prev) => [...prev, novo]);
      setForm({ tipo: "extrato_bancario", banco: "", conta: "", agencia: "", descricao: "" });
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    await fetch(`${API}/tipos-esperados/${id}`, { method: "DELETE" });
    setTipos((prev) => prev.filter((t) => t.id !== id));
  }

  const tipoLabel = (val: string) => TIPOS_DOC.find((t) => t.value === val)?.label ?? val;

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Documentos esperados mensalmente</h2>
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
