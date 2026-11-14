"use client";
import Link from "next/link";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

type Lancamento = {
  id: string;
  data_lancamento: string;
  conta_debito: string;
  conta_credito: string;
  valor: number;
  historico: string | null;
  complemento_historico: string | null;
  cod_historico: string | null;
  lote: string | null;
  status: string;
  origem: string;
  exportado_em: string | null;
};

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  pendente: { bg: "#fef3c7", text: "#92400e", label: "Pendente" },
  confirmado: { bg: "#dcfce7", text: "#15803d", label: "Confirmado" },
  exportado: { bg: "#e0e7ff", text: "#3730a3", label: "Exportado" },
  rejeitado: { bg: "#fee2e2", text: "#991b1b", label: "Rejeitado" },
};

export default function LancamentosClient({
  empresa,
  lancamentosIniciais,
}: {
  empresa: { id: string; nome: string; codigo: string } | null;
  lancamentosIniciais: Lancamento[];
}) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lancamentosIniciais);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [exportando, setExportando] = useState(false);
  const [mesExportar, setMesExportar] = useState("");

  const empresaId = empresa?.id ?? "";

  async function confirmar(id: string) {
    const res = await fetch(`${API}/lancamentos/${id}/confirmar`, { method: "PATCH" });
    if (res.ok) {
      const updated: Lancamento = await res.json();
      setLancamentos((prev) => prev.map((l) => (l.id === id ? updated : l)));
    }
  }

  async function exportarDominio() {
    setExportando(true);
    try {
      const url = mesExportar
        ? `${API}/empresas/${empresaId}/lancamentos/exportar-dominio?mes=${mesExportar}`
        : `${API}/empresas/${empresaId}/lancamentos/exportar-dominio`;
      const res = await fetch(url);
      const txt = await res.text();
      if (!txt.trim()) {
        alert("Nenhum lançamento confirmado disponível para exportação.");
        return;
      }
      const blob = new Blob([txt], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `lactos_${empresa?.codigo ?? "empresa"}_${mesExportar || "todos"}.txt`;
      a.click();
      // Atualiza status localmente
      setLancamentos((prev) =>
        prev.map((l) => (l.status === "confirmado" ? { ...l, status: "exportado", exportado_em: new Date().toISOString() } : l))
      );
    } finally {
      setExportando(false);
    }
  }

  const filtrado = lancamentos.filter((l) => {
    const matchStatus = filtroStatus === "todos" || l.status === filtroStatus;
    const matchBusca =
      !filtroBusca ||
      l.conta_debito.includes(filtroBusca) ||
      l.conta_credito.includes(filtroBusca) ||
      (l.historico ?? "").toLowerCase().includes(filtroBusca.toLowerCase());
    return matchStatus && matchBusca;
  });

  const pendentes = lancamentos.filter((l) => l.status === "pendente").length;
  const confirmados = lancamentos.filter((l) => l.status === "confirmado").length;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: "#6b7280" }}>
        <Link href="/dashboard/empresas" style={{ color: "#c4a030", textDecoration: "none" }}>Empresas</Link>
        <span>›</span>
        <Link href={`/dashboard/empresas/${empresaId}`} style={{ color: "#c4a030", textDecoration: "none" }}>{empresa?.nome ?? "..."}</Link>
        <span>›</span>
        <span>Lançamentos Contábeis</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Lançamentos Contábeis</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            {pendentes > 0 && <span style={{ color: "#92400e", fontWeight: 600 }}>{pendentes} pendente{pendentes !== 1 ? "s" : ""} · </span>}
            {confirmados} pronto{confirmados !== 1 ? "s" : ""} para exportar
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="month"
            value={mesExportar}
            onChange={(e) => setMesExportar(e.target.value)}
            style={{ padding: "7px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13 }}
          />
          <button
            onClick={exportarDominio}
            disabled={exportando || confirmados === 0}
            style={{
              padding: "8px 18px",
              background: confirmados > 0 ? "#0c1a2e" : "#e5e7eb",
              color: confirmados > 0 ? "#c4a030" : "#9ca3af",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: confirmados > 0 ? "pointer" : "default",
            }}
          >
            {exportando ? "Exportando..." : "⬇ Exportar Domínio"}
          </button>
          <Link
            href={`/dashboard/empresas/${empresaId}/plano-contas`}
            style={{ padding: "8px 14px", background: "transparent", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, textDecoration: "none" }}
          >
            Plano de Contas
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          placeholder="Buscar por conta ou histórico..."
          value={filtroBusca}
          onChange={(e) => setFiltroBusca(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, width: 280 }}
        />
        {["todos", "pendente", "confirmado", "exportado"].map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            style={{
              padding: "7px 14px",
              border: `1px solid ${filtroStatus === s ? "#c4a030" : "#e5e7eb"}`,
              borderRadius: 8,
              background: filtroStatus === s ? "#fef9ec" : "#fff",
              color: filtroStatus === s ? "#c4a030" : "#6b7280",
              fontSize: 13,
              fontWeight: filtroStatus === s ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {s === "todos" ? "Todos" : STATUS_COLOR[s]?.label ?? s}
            {s !== "todos" && (
              <span style={{ marginLeft: 6, fontSize: 11 }}>
                ({lancamentos.filter((l) => l.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        {filtrado.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            {lancamentos.length === 0
              ? "Nenhum lançamento ainda. Envie um extrato bancário para gerar lançamentos automaticamente."
              : "Nenhum lançamento para o filtro selecionado."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151", width: 90 }}>Data</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Débito</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Crédito</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: "#374151", width: 110 }}>Valor</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Histórico</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", width: 70 }}>Origem</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", width: 90 }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: "#374151", width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map((l) => {
                const st = STATUS_COLOR[l.status] ?? STATUS_COLOR.pendente;
                return (
                  <tr key={l.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "9px 14px", color: "#374151", fontFamily: "monospace", fontSize: 12 }}>
                      {l.data_lancamento}
                    </td>
                    <td style={{ padding: "9px 14px", fontFamily: "monospace", fontWeight: 600 }}>{l.conta_debito}</td>
                    <td style={{ padding: "9px 14px", fontFamily: "monospace", fontWeight: 600 }}>{l.conta_credito}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>
                      {l.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td style={{ padding: "9px 14px", color: "#4b5563", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.historico ?? "—"}
                      {l.complemento_historico && (
                        <span style={{ color: "#9ca3af", marginLeft: 6 }}>{l.complemento_historico}</span>
                      )}
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "center", color: l.origem === "ia" ? "#7c3aed" : "#6b7280", fontSize: 11, fontWeight: 600 }}>
                      {l.origem === "ia" ? "IA" : "Manual"}
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: st.bg, color: st.text }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      {l.status === "pendente" && (
                        <button
                          onClick={() => confirmar(l.id)}
                          style={{ padding: "4px 12px", background: "#dcfce7", color: "#15803d", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          Confirmar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
        {filtrado.length} lançamento{filtrado.length !== 1 ? "s" : ""} · total: {lancamentos.length}
      </div>

      {/* Info sobre exportação Domínio */}
      <div style={{ marginTop: 24, padding: 16, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 12, color: "#0369a1" }}>
        <strong>Importação no Domínio:</strong> Utilitários → Importação → Importador → Importar · Dataset: Lançamentos Contábeis (Partida Simples/Múltiplas) (3.1) · Arquivo: <code>lactos.txt</code>
      </div>
    </div>
  );
}
