"use client";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  classificado: "Classificado",
  pasta_errada: "Pasta errada",
  em_revisao: "Em revisão",
  revisado: "Revisado",
  nao_reconhecido: "Não reconhecido",
  duplicata: "Duplicata",
  empresa_errada: "Empresa errada",
};

const statusColor: Record<string, string> = {
  pendente: "#f59e0b",
  classificado: "#16a34a",
  pasta_errada: "#ef4444",
  em_revisao: "#8b5cf6",
  revisado: "#2563eb",
  nao_reconhecido: "#6b7280",
  duplicata: "#ea580c",
  empresa_errada: "#b91c1c",
};

type Documento = {
  id: string;
  nome_arquivo: string;
  tipo: string | null;
  mes_referencia: string | null;
  banco: string | null;
  conta: string | null;
  status: string;
  detectado_em: string;
  excluido_em?: string | null;
  excluido_por?: string | null;
};

export default function DocumentosTable({ documentos: inicial }: { documentos: Documento[] }) {
  const [docs, setDocs] = useState<Documento[]>(inicial);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [historico, setHistorico] = useState(false);

  const visiveis = historico ? docs : docs.filter((d) => d.status !== "excluido");

  async function excluir(id: string) {
    setExcluindo(id);
    try {
      const res = await fetch(`${API}/documentos/${id}?remover_arquivo=true`, {
        method: "DELETE",
        headers: { "X-Excluido-Por": "usuario_app" },
      });
      if (!res.ok) throw new Error("Falha ao excluir");
      const result = await res.json();
      setDocs((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, status: "excluido", excluido_em: result.excluido_em, excluido_por: result.excluido_por }
            : d
        )
      );
    } catch {
      alert("Erro ao excluir. Tente novamente.");
    } finally {
      setExcluindo(null);
      setConfirmando(null);
    }
  }

  if (!docs.length) {
    return <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum documento detectado ainda.</p>;
  }

  return (
    <div>
      {/* Controles */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {visiveis.length} documento{visiveis.length !== 1 ? "s" : ""}
          {!historico && docs.some((d) => d.status === "excluido") && (
            <span> · {docs.filter((d) => d.status === "excluido").length} excluído(s) oculto(s)</span>
          )}
        </span>
        {docs.some((d) => d.status === "excluido") && (
          <button
            onClick={() => setHistorico((v) => !v)}
            style={{ fontSize: 12, color: "#6b7280", background: "transparent", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            {historico ? "Ocultar histórico" : "Ver histórico de exclusões"}
          </button>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <th style={th}>Arquivo</th>
            <th style={th}>Tipo</th>
            <th style={th}>Mês ref.</th>
            <th style={th}>Banco / Conta</th>
            <th style={th}>Status</th>
            <th style={th}>Recebido em</th>
            <th style={{ ...th, width: 80 }}></th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map((d) => {
            const isExcluido = d.status === "excluido";
            return (
              <tr
                key={d.id}
                style={{
                  borderTop: "1px solid #e5e7eb",
                  opacity: isExcluido ? 0.5 : 1,
                  background: isExcluido ? "#fafafa" : undefined,
                }}
              >
                <td style={{ ...td, textDecoration: isExcluido ? "line-through" : undefined }}>
                  {d.nome_arquivo}
                </td>
                <td style={td}>{d.tipo ?? "—"}</td>
                <td style={td}>{d.mes_referencia ?? "—"}</td>
                <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>
                  {d.banco ? `${d.banco}${d.conta ? ` CC ${d.conta}` : ""}` : "—"}
                </td>
                <td style={td}>
                  {isExcluido ? (
                    <div>
                      <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 500 }}>Excluído</span>
                      {d.excluido_em && (
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {new Date(d.excluido_em).toLocaleDateString("pt-BR")} · {d.excluido_por}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: statusColor[d.status] ?? "#000", fontWeight: 500, fontSize: 13 }}>
                      {statusLabel[d.status] ?? d.status}
                    </span>
                  )}
                </td>
                <td style={td}>{new Date(d.detectado_em).toLocaleDateString("pt-BR")}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {!isExcluido && (
                    confirmando === d.id ? (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => excluir(d.id)}
                          disabled={excluindo === d.id}
                          style={{ fontSize: 12, padding: "3px 8px", background: "#b91c1c", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
                        >
                          {excluindo === d.id ? "..." : "Confirmar"}
                        </button>
                        <button
                          onClick={() => setConfirmando(null)}
                          style={{ fontSize: 12, padding: "3px 8px", background: "transparent", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", color: "#6b7280" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmando(d.id)}
                        title="Excluir importação"
                        style={{ fontSize: 13, color: "#9ca3af", background: "transparent", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4 }}
                      >
                        🗑
                      </button>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
