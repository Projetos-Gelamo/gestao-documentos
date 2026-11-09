"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

type MesData = { recebido: boolean; documento_id: string | null; documento_nome: string | null };
type TipoAnual = {
  tipo_id: string;
  tipo: string;
  descricao: string;
  banco: string | null;
  conta: string | null;
  meses: Record<string, MesData>;
};
type VIsaoAnual = { ano: number; empresa_id: string; tipos: TipoAnual[] };

function mesAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AnnualView({ empresaId, empresaNome }: { empresaId: string; empresaNome: string }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [data, setData] = useState<VIsaoAnual | null>(null);
  const [loading, setLoading] = useState(true);
  const atual = mesAtual();

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/empresas/${empresaId}/visao-anual?ano=${ano}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, [empresaId, ano]);

  const totalCols = 12;
  const mesKey = (m: number) => `${ano}-${String(m).padStart(2, "0")}`;

  const totalEsperados = (data?.tipos.length ?? 0) * 12;
  const totalRecebidos = data?.tipos.reduce((acc, t) =>
    acc + Object.values(t.meses).filter((m) => m.recebido).length, 0) ?? 0;
  const pct = totalEsperados > 0 ? Math.round((totalRecebidos / totalEsperados) * 100) : 0;

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <a href={`/dashboard/empresas/${empresaId}`} style={{ fontSize: 13, color: "#c4a030", textDecoration: "none" }}>
          ← {empresaNome}
        </a>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0c1a2e", marginBottom: 2 }}>
              Visão Anual · {empresaNome}
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280" }}>Recebimento mensal de documentos · Exercício {ano}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, background: "white", cursor: "pointer" }}
            >
              {[ano - 1, ano, ano + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Resumo */}
        {data && data.tipos.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard label="Total esperado" value={`${totalEsperados} docs`} color="#0c1a2e" />
            <StatCard label="Recebidos" value={`${totalRecebidos}`} color="#16a34a" />
            <StatCard label="Pendentes" value={`${totalEsperados - totalRecebidos}`} color="#ef4444" />
            <StatCard label="Completude" value={`${pct}%`} color="#c4a030" />
          </div>
        )}
      </div>

      {loading && <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando...</p>}

      {!loading && data && data.tipos.length === 0 && (
        <div style={{ background: "white", borderRadius: 10, padding: 32, textAlign: "center", color: "#9ca3af" }}>
          <p style={{ fontSize: 15 }}>Nenhum documento esperado configurado para esta empresa.</p>
          <a href={`/dashboard/empresas/${empresaId}`} style={{ color: "#c4a030", fontSize: 13, marginTop: 8, display: "inline-block" }}>
            Configurar documentos esperados →
          </a>
        </div>
      )}

      {!loading && data && data.tipos.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.08)", minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#0c1a2e" }}>
                <th style={{ ...th, color: "#c4a030", textAlign: "left", minWidth: 200 }}>DOCUMENTO</th>
                {MESES_ABREV.map((m, i) => (
                  <th key={m} style={{
                    ...th,
                    color: mesKey(i + 1) === atual ? "#c4a030" : "#8ea8c8",
                    fontWeight: mesKey(i + 1) === atual ? 700 : 500,
                    minWidth: 56,
                  }}>{m}</th>
                ))}
                <th style={{ ...th, color: "#8ea8c8", minWidth: 56 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.tipos.map((tipo, idx) => {
                const recebidosAno = Object.values(tipo.meses).filter((m) => m.recebido).length;
                return (
                  <tr key={tipo.tipo_id} style={{ borderTop: "1px solid #f1f5f9", background: idx % 2 === 0 ? "white" : "#fafbfc" }}>
                    <td style={{ padding: "11px 16px", fontSize: 13 }}>
                      <div style={{ fontWeight: 500, color: "#0c1a2e" }}>{tipo.descricao}</div>
                      {tipo.banco && (
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                          {tipo.banco}{tipo.conta ? ` · CC ${tipo.conta}` : ""}
                        </div>
                      )}
                    </td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const mk = mesKey(m);
                      const mes = tipo.meses[mk];
                      const isFuture = mk > atual;
                      const isCurrent = mk === atual;
                      return (
                        <td key={m} style={{ padding: "10px 8px", textAlign: "center" }} title={mes?.documento_nome || undefined}>
                          <Cell recebido={mes?.recebido ?? false} future={isFuture} current={isCurrent} />
                        </td>
                      );
                    })}
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: recebidosAno === 12 ? "#16a34a" : recebidosAno > 0 ? "#c4a030" : "#6b7280" }}>
                        {recebidosAno}/12
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totais por mês */}
            <tfoot>
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb" }}>
                <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#6b7280" }}>RECEBIDOS</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const mk = mesKey(m);
                  const count = data.tipos.filter((t) => t.meses[mk]?.recebido).length;
                  const total = data.tipos.length;
                  return (
                    <td key={m} style={{ padding: "10px 8px", textAlign: "center", fontSize: 12, fontWeight: 600, color: count === total ? "#16a34a" : count > 0 ? "#c4a030" : "#9ca3af" }}>
                      {count}/{total}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tfoot>
          </table>

          {/* Legenda */}
          <div style={{ marginTop: 12, display: "flex", gap: 20, fontSize: 12, color: "#6b7280" }}>
            <span><Cell recebido={true} future={false} current={false} /> Recebido</span>
            <span><Cell recebido={false} future={false} current={false} /> Pendente</span>
            <span><Cell recebido={false} future={false} current={true} /> Mês atual</span>
            <span><Cell recebido={false} future={true} current={false} /> Mês futuro</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ recebido, future, current }: { recebido: boolean; future: boolean; current: boolean }) {
  if (recebido) return <span style={cell("#dcfce7", "#16a34a")}>✓</span>;
  if (future) return <span style={cell("#f3f4f6", "#d1d5db")}>—</span>;
  if (current) return <span style={cell("#fef3c7", "#d97706")}>⏳</span>;
  return <span style={cell("#fee2e2", "#ef4444")}>✗</span>;
}

function cell(bg: string, color: string): React.CSSProperties {
  return { display: "inline-block", width: 24, height: 24, lineHeight: "24px", textAlign: "center", borderRadius: 4, background: bg, color, fontSize: 11, fontWeight: 700 };
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "white", borderRadius: 8, padding: "12px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.07)", minWidth: 100 }}>
      <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" };
