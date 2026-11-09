const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

export default async function RevisaoPage() {
  const res = await fetch(`${API}/revisao/`, { cache: "no-store" });
  const itens: any[] = res.ok ? await res.json() : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Fila de Revisão</h1>
      {!itens.length ? (
        <p style={{ color: "#16a34a" }}>✓ Nenhum documento aguardando revisão.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <thead>
            <tr style={{ background: "#fef3c7" }}>
              <th style={th}>Empresa</th>
              <th style={th}>Arquivo</th>
              <th style={th}>Tipo detectado</th>
              <th style={th}>Na fila desde</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{item.documento?.empresa?.nome ?? "—"}</td>
                <td style={td}>{item.documento?.nome_arquivo ?? "—"}</td>
                <td style={td}>{item.documento?.tipo ?? "não reconhecido"}</td>
                <td style={td}>{new Date(item.criado_em).toLocaleDateString("pt-BR")}</td>
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
