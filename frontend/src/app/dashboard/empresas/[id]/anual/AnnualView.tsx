"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

type MesData = { recebido: boolean; aplicavel?: boolean; documento_id: string | null; documento_nome: string | null };
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

type PreviewState = { docId: string; docNome: string; url: string } | null;

export default function AnnualView({ empresaId, empresaNome, inline }: { empresaId: string; empresaNome: string; inline?: boolean }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [data, setData] = useState<VIsaoAnual | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewState, setPreviewState] = useState<PreviewState>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const atual = mesAtual();

  async function handleCellClick(docId: string, docNome: string) {
    if (previewLoading) return;
    setPreviewLoading(docId);
    try {
      const r = await fetch(`${API}/documentos/${docId}/preview`);
      const d = await r.json();
      if (d.url) {
        setPreviewState({ docId, docNome, url: d.url });
      } else {
        alert("Não foi possível carregar o arquivo.");
      }
    } catch {
      alert("Erro ao carregar preview.");
    } finally {
      setPreviewLoading(null);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/empresas/${empresaId}/visao-anual?ano=${ano}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, [empresaId, ano]);

  const totalCols = 12;
  const mesKey = (m: number) => `${ano}-${String(m).padStart(2, "0")}`;

  const totalEsperados = data?.tipos.reduce((acc, t) =>
    acc + Object.values(t.meses).filter((m) => m.aplicavel !== false).length, 0) ?? 0;
  const totalRecebidos = data?.tipos.reduce((acc, t) =>
    acc + Object.values(t.meses).filter((m) => m.recebido).length, 0) ?? 0;
  const pct = totalEsperados > 0 ? Math.round((totalRecebidos / totalEsperados) * 100) : 0;

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        {!inline && (
          <a href={`/dashboard/empresas/${empresaId}`} style={{ fontSize: 13, color: "#c4a030", textDecoration: "none" }}>
            ← {empresaNome}
          </a>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: inline ? 0 : 8 }}>
          {!inline && (
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0c1a2e", marginBottom: 2 }}>
                Controle de Documentos · {empresaNome}
              </h1>
              <p style={{ fontSize: 13, color: "#6b7280" }}>Recebimento mensal de documentos · Exercício {ano}</p>
            </div>
          )}
          {inline && (
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Recebimento mensal · Exercício {ano}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, background: "white", cursor: "pointer" }}
            >
              {[ano - 2, ano - 1, ano, ano + 1].map((y) => <option key={y} value={y}>{y}</option>)}
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
          {!inline && (
            <a href={`/dashboard/empresas/${empresaId}`} style={{ color: "#c4a030", fontSize: 13, marginTop: 8, display: "inline-block" }}>
              Configurar documentos esperados →
            </a>
          )}
          {inline && (
            <p style={{ color: "#c4a030", fontSize: 13, marginTop: 8 }}>Acesse a aba Configurações para cadastrar os documentos esperados.</p>
          )}
        </div>
      )}

      {previewState && (
        <PreviewModal
          url={previewState.url}
          nome={previewState.docNome}
          onClose={() => setPreviewState(null)}
        />
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
                      const inaplicavel = mes?.aplicavel === false;
                      const hasDoc = !!mes?.documento_id;
                      const isLoadingThis = previewLoading === mes?.documento_id;
                      return (
                        <td
                          key={m}
                          style={{ padding: "10px 8px", textAlign: "center", cursor: hasDoc ? "pointer" : "default" }}
                          title={mes?.documento_nome || undefined}
                          onClick={hasDoc && mes?.documento_id ? () => handleCellClick(mes.documento_id!, mes.documento_nome || "arquivo") : undefined}
                        >
                          <Cell
                            recebido={mes?.recebido ?? false}
                            future={isFuture}
                            current={isCurrent}
                            inaplicavel={inaplicavel}
                            interactive={hasDoc}
                            loading={isLoadingThis}
                          />
                        </td>
                      );
                    })}
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      {(() => {
                        const aplicaveis = Object.values(tipo.meses).filter((m) => m.aplicavel !== false).length;
                        return (
                          <span style={{ fontSize: 12, fontWeight: 700, color: recebidosAno === aplicaveis ? "#16a34a" : recebidosAno > 0 ? "#c4a030" : "#6b7280" }}>
                            {recebidosAno}/{aplicaveis}
                          </span>
                        );
                      })()}
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
                  const total = data.tipos.filter((t) => t.meses[mk]?.aplicavel !== false).length;
                  if (total === 0) return (
                    <td key={m} style={{ padding: "10px 8px", textAlign: "center", fontSize: 12, color: "#d1d5db" }}>—</td>
                  );
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

function Cell({ recebido, future, current, inaplicavel, interactive, loading }: {
  recebido: boolean; future: boolean; current: boolean;
  inaplicavel?: boolean; interactive?: boolean; loading?: boolean;
}) {
  const extra: React.CSSProperties = interactive
    ? { boxShadow: "0 0 0 2px #16a34a44", outline: "none" }
    : {};
  if (loading) return <span style={{ ...cell("#dcfce7", "#16a34a"), ...extra, opacity: 0.6 }}>…</span>;
  if (inaplicavel) return <span style={cell("#f3f4f6", "#d1d5db")}>—</span>;
  if (recebido) return <span style={{ ...cell("#dcfce7", "#16a34a"), ...extra }}>✓</span>;
  if (future) return <span style={cell("#f3f4f6", "#d1d5db")}>—</span>;
  if (current) return <span style={cell("#fef3c7", "#d97706")}>⏳</span>;
  return <span style={cell("#fee2e2", "#ef4444")}>✗</span>;
}

function cell(bg: string, color: string): React.CSSProperties {
  return { display: "inline-block", width: 24, height: 24, lineHeight: "24px", textAlign: "center", borderRadius: 4, background: bg, color, fontSize: 11, fontWeight: 700 };
}

function PreviewModal({ url, nome, onClose }: { url: string; nome: string; onClose: () => void }) {
  const ext = nome.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "webp", "tiff", "bmp", "gif"].includes(ext);
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", flexDirection: "column" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "rgba(0,0,0,0.5)", flexShrink: 0 }}>
        <span style={{ color: "white", fontSize: 13, fontWeight: 500, maxWidth: "calc(100% - 160px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {nome}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={url}
            download={nome}
            style={{ padding: "5px 14px", background: "rgba(196,160,48,0.2)", color: "#c4a030", border: "1px solid #c4a030", borderRadius: 6, fontSize: 12, textDecoration: "none" }}
          >
            ⬇ Baixar
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "5px 14px", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, fontSize: 12, textDecoration: "none" }}
          >
            Abrir em nova aba
          </a>
          <button onClick={onClose} style={{ padding: "5px 14px", background: "white", color: "#0c1a2e", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ✕ Fechar
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
        {isImage
          ? <img src={url} alt={nome} style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 6, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }} />
          : <iframe src={url} title={nome} style={{ width: "100%", maxWidth: 900, height: "85vh", border: "none", borderRadius: 6, background: "white" }} />
        }
      </div>
    </div>
  );
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
