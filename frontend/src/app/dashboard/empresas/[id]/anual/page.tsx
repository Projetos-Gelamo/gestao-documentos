import { notFound } from "next/navigation";
import AnnualView from "./AnnualView";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

export default async function AnnualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${API}/empresas/${id}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const empresa = await res.json();
  return <AnnualView empresaId={id} empresaNome={empresa.nome} />;
}
