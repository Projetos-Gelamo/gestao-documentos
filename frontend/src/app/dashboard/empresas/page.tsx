import EmpresasListClient from "./EmpresasListClient";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

export default async function EmpresasPage() {
  const res = await fetch(`${API}/empresas/`, { cache: "no-store" });
  const empresas = res.ok ? await res.json() : [];

  return <EmpresasListClient empresas={empresas} />;
}
