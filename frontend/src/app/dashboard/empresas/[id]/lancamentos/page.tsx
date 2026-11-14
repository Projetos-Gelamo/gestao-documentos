import LancamentosClient from "./LancamentosClient";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

export default async function LancamentosPage({ params }: { params: { id: string } }) {
  const { id } = await params;

  const [empRes, lancRes] = await Promise.all([
    fetch(`${API}/empresas/${id}`, { cache: "no-store" }),
    fetch(`${API}/empresas/${id}/lancamentos`, { cache: "no-store" }),
  ]);

  const empresa = empRes.ok ? await empRes.json() : null;
  const lancamentos = lancRes.ok ? await lancRes.json() : [];

  return <LancamentosClient empresa={empresa} lancamentosIniciais={lancamentos} />;
}
