"use client";
import Link from "next/link";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

type Conta = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  codigo_pai: string | null;
  nivel: number;
  aceita_lancamento: boolean;
};

const TIPOS = ["ativo", "passivo", "patrimonio", "receita", "despesa", "resultado"];

export default function PlanoContasClient({
  empresa,
  planoInicial,
}: {
  empresa: { id: string; nome: string; codigo: string } | null;
  planoInicial: Conta[];
}) {
  const [plano, setPlano] = useState<Conta[]>(planoInicial);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({ codigo: "", nome: "", tipo: "ativo", codigo_pai: "", nivel: 1, aceita_lancamento: true });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [busca, setBusca] = useState("");

  const empresaId = empresa?.id ?? "";

  async function adicionarConta() {
    if (!novo.codigo.trim() || !novo.nome.trim()) return;
    setSalvando(true);
    try {
      const res = await fetch(`${API}/empresas/${empresaId}/plano-contas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...novo, empresa_id: empresaId, codigo_pai: novo.codigo_pai || null }),
      });
      if (res.ok) {
        const criada: Conta = await res.json();
        setPlano((p) => [...p, criada].sort((a, b) => a.codigo.localeCompare(b.codigo)));
        setNovo({ codigo: "", nome: "", tipo: "ativo", codigo_pai: "", nivel: 1, aceita_lancamento: true });
        setMostrarForm(false);
      }
    } finally {
      setSalvando(false);
    }
  }

  async function removerConta(id: string) {
    if (!confirm("Remover esta conta?")) return;
    await fetch(`${API}/plano-contas/${id}`, { method: "DELETE" });
    setPlano((p) => p.filter((c) => c.id !== id));
  }

  const filtrado = plano.filter(
    (c) =>
      c.codigo.toLowerCase().includes(busca.toLowerCase()) ||
      c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const corTipo: Record<string, string> = {
    ativo: "#16a34a", passivo: "#dc2626", patrimonio: "#7c3aed",
    receita: "#0284c7", despesa: "#ea580c", resultado: "#c4a030",
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: "#6b7280" }}>
        <Link href="/dashboard/empresas" style={{ color: "#c4a030", textDecoration: "none" }}>Empresas</Link>
        <span>›</span>
        <Link href={`/dashboard/empresas/${empresaId}`} style={{ color: "#c4a030", textDecoration: "none" }}>{empresa?.nome ?? "..."}</Link>
        <span>›</span>
        <span>Plano de Contas</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Plano de Contas</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="Buscar código ou nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, width: 220 }}
          />
          <button
            onClick={() => setMostrarForm((v) => !v)}
            style={{ padding: "8px 16px", background: "#c4a030", color: "#0c1a2e", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + Nova conta
          </button>
        </div>
      </div>

      {/* Formulário nova conta */}
      {mostrarForm && (
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Nova conta</h3>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 160px 100px", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Código *</label>
              <input
                value={novo.codigo}
                onChange={(e) => setNovo((n) => ({ ...n, codigo: e.target.value }))}
                placeholder="1.1.01"
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Nome *</label>
              <input
                value={novo.nome}
                onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
                placeholder="Caixa e Equivalentes de Caixa"
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Tipo</label>
              <select
                value={novo.tipo}
                onChange={(e) => setNovo((n) => ({ ...n, tipo: e.target.value }))}
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13 }}
              >
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Nível</label>
              <input
                type="number"
                min={1}
                max={5}
                value={novo.nivel}
                onChange={(e) => setNovo((n) => ({ ...n, nivel: Number(e.target.value) }))}
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13 }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              value={novo.codigo_pai}
              onChange={(e) => setNovo((n) => ({ ...n, codigo_pai: e.target.value }))}
              placeholder="Código pai (opcional)"
              style={{ padding: "7px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, width: 200 }}
            />
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={novo.aceita_lancamento}
                onChange={(e) => setNovo((n) => ({ ...n, aceita_lancamento: e.target.checked }))}
              />
              Aceita lançamento
            </label>
            <button
              onClick={adicionarConta}
              disabled={salvando}
              style={{ padding: "8px 20px", background: "#0c1a2e", color: "#c4a030", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => setMostrarForm(false)}
              style={{ padding: "8px 14px", background: "transparent", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabela de contas */}
      <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        {filtrado.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            {plano.length === 0 ? "Nenhuma conta cadastrada. Clique em \"+ Nova conta\" para começar." : "Nenhum resultado para a busca."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Código</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Nome</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Tipo</th>
                <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 600, color: "#374151" }}>Nível</th>
                <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 600, color: "#374151" }}>Lançamento</th>
                <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "#374151" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 600 }}>{c.codigo}</td>
                  <td style={{ padding: "10px 16px", paddingLeft: `${(c.nivel - 1) * 16 + 16}px` }}>{c.nome}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: `${corTipo[c.tipo]}20`, color: corTipo[c.tipo] }}>
                      {c.tipo}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "center", color: "#6b7280" }}>{c.nivel}</td>
                  <td style={{ padding: "10px 16px", textAlign: "center" }}>
                    {c.aceita_lancamento ? (
                      <span style={{ color: "#16a34a", fontSize: 15 }}>✓</span>
                    ) : (
                      <span style={{ color: "#d1d5db", fontSize: 15 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => removerConta(c.id)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, padding: "2px 6px" }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
        {filtrado.length} conta{filtrado.length !== 1 ? "s" : ""} · total no plano: {plano.length}
      </div>
    </div>
  );
}
