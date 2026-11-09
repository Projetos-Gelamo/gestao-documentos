import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function EmpresasPage() {
  const supabase = await createSupabaseServerClient();
  const { data: empresas } = await supabase
    .schema("gestao_docs")
    .from("empresa")
    .select("id, codigo, cnpj, nome")
    .order("nome");

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Empresas</h1>
        <Link
          href="/dashboard/empresas/nova"
          style={{
            background: '#2563eb', color: 'white', borderRadius: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          + Nova empresa
        </Link>
      </div>
      {!empresas?.length ? (
        <p style={{ color: "#6b7280" }}>Nenhuma empresa cadastrada.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th style={th}>Código</th>
              <th style={th}>CNPJ</th>
              <th style={th}>Nome</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{e.codigo}</td>
                <td style={td}>{e.cnpj}</td>
                <td style={td}>{e.nome}</td>
                <td style={td}>
                  <Link href={`/dashboard/empresas/${e.id}`} style={{ color: "#2563eb", fontSize: 13 }}>
                    Ver documentos →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#374151" };
const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
