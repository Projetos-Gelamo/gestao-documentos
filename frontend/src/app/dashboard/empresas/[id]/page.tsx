import { notFound } from "next/navigation";
import EmpresaDetalheClient from "./EmpresaDetalheClient";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

export default async function EmpresaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [empresaRes, documentosRes] = await Promise.all([
    fetch(`${API}/empresas/${id}`, { cache: "no-store" }),
    fetch(`${API}/documentos/?empresa_id=${id}`, { cache: "no-store" }),
  ]);

  if (!empresaRes.ok) notFound();

  const empresa = await empresaRes.json();
  const documentos: any[] = documentosRes.ok ? await documentosRes.json() : [];

  return <EmpresaDetalheClient empresa={empresa} documentos={documentos} />;
}
