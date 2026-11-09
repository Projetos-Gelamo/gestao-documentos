const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

export default async function DashboardPage() {
  const [empresas, pendentes, revisao] = await Promise.all([
    fetch(`${API}/empresas/`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
    fetch(`${API}/documentos/?status=pendente`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
    fetch(`${API}/revisao/`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Painel</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <Card title="Empresas monitoradas" value={empresas.length} />
        <Card title="Documentos pendentes" value={pendentes.length} color="#f59e0b" />
        <Card title="Aguardando revisão" value={revisao.length} color="#ef4444" />
      </div>
    </div>
  );
}

function Card({ title, value, color = "#2563eb" }: { title: string; value: number; color?: string }) {
  return (
    <div style={{ background: "white", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 32, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
