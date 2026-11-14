import PlanoContasClient from "./PlanoContasClient";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

export default async function PlanoContasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [empRes, planoRes] = await Promise.all([
    fetch(`${API}/empresas/${id}`, { cache: "no-store" }),
    fetch(`${API}/empresas/${id}/plano-contas`, { cache: "no-store" }),
  ]);

  const empresa = empRes.ok ? await empRes.json() : null;
  const plano = planoRes.ok ? await planoRes.json() : [];

  return <PlanoContasClient empresa={empresa} planoInicial={plano} />;
}
