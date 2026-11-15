import { notFound } from "next/navigation";
import ConfiguracoesClient from "./ConfiguracoesClient";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

export default async function ConfiguracoesPage({ params }: { params: { id: string } }) {
  const res = await fetch(`${API}/empresas/${params.id}`, { cache: "no-store" });
  if (!res.ok) return notFound();
  const empresa = await res.json();
  return <ConfiguracoesClient empresa={empresa} />;
}
