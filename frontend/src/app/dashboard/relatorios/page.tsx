const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

export default async function RelatoriosPage() {
  const res = await fetch(`${API}/relatorios/erros`, { cache: "no-store" });
  const erros: any[] = res.ok ? await res.json() : [];

  const tipoLabel: Record<string, string> = {
    pasta_errada: "Pasta errada",
    pendente_revisao: "Pendente de revisão",
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Relatórios de Erro</h1>
      {!erros.length ? (
        <p style={{ color: "#16a34a" }}>✓ Nenhum erro registrado.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <thead>
            <tr style={{ background: "#fee2e2" }}>
              <th style={th}>Data</th>
              <th style={th}>Empresa</th>
              <th style={th}>Documento</th>
              <th style={th}>Tipo de erro</th>
            </tr>
          </thead>
          <tbody>
            {erros.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{new Date(e.data).toLocaleDateString("pt-BR")}</td>
                <td style={td}>{e.empresa?.nome ?? "—"}</td>
                <td style={td}>{e.documento?.nome_arquivo ?? "—"}</td>
                <td style={{ ...td, color: "#ef4444", fontWeight: 500 }}>
                  {tipoLabel[e.tipo_erro] ?? e.tipo_erro}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
