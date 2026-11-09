"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

function mesAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type ChecklistItem = {
  tipo_id: string;
  tipo: string;
  descricao: string;
  banco: string | null;
  conta: string | null;
  recebido: boolean;
  documento_id: string | null;
  documento_nome: string | null;
};

type Checklist = {
  mes: string;
  total: number;
  recebidos: number;
  pendentes: number;
  itens: ChecklistItem[];
};

export default function ChecklistSection({ empresaId }: { empresaId: string }) {
  const [mes, setMes] = useState(mesAtual);
  const [data, setData] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/empresas/${empresaId}/checklist?mes=${mes}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, [empresaId, mes]);

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Checklist mensal</h2>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px", fontSize: 13 }}
        />
      </div>

      {loading && <p style={{ fontSize: 13, color: "#9ca3af" }}>Carregando...</p>}

      {!loading && data && data.total === 0 && (
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Nenhum documento esperado configurado. Configure acima.</p>
      )}

      {!loading && data && data.total > 0 && (
        <>
          {/* Barra de progresso */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
              <span>{data.recebidos} de {data.total} recebidos</span>
              <span style={{ color: data.pendentes > 0 ? "#ef4444" : "#16a34a", fontWeight: 600 }}>
                {data.pendentes > 0 ? `${data.pendentes} pendente${data.pendentes > 1 ? "s" : ""}` : "Completo ✓"}
              </span>
            </div>
            <div style={{ background: "#e5e7eb", borderRadius: 99, height: 8 }}>
              <div style={{ background: data.pendentes > 0 ? "#f59e0b" : "#16a34a", borderRadius: 99, height: 8, width: `${(data.recebidos / data.total) * 100}%`, transition: "width .3s" }} />
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={th}>Documento</th>
                <th style={th}>Status</th>
                <th style={th}>Arquivo recebido</th>
              </tr>
            </thead>
            <tbody>
              {data.itens.map((item) => (
                <tr key={item.tipo_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={td}>{item.descricao}</td>
                  <td style={td}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 600,
                      background: item.recebido ? "#dcfce7" : "#fee2e2",
                      color: item.recebido ? "#15803d" : "#b91c1c",
                    }}>
                      {item.recebido ? "✓ Recebido" : "✗ Pendente"}
                    </span>
                  </td>
                  <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>
                    {item.documento_nome ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" };
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 13 };
