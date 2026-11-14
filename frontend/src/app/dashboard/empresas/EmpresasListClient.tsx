"use client";
import Link from "next/link";
import { useAnon } from "../AnonContext";

type Empresa = { id: string; codigo: string; cnpj: string; nome: string; matriz_id?: string | null };

export default function EmpresasListClient({ empresas }: { empresas: Empresa[] }) {
  const { anonimizado } = useAnon();

  const matrizes = empresas.filter((e) => !e.matriz_id);
  const filiais = empresas.filter((e) => !!e.matriz_id);
  const filiaisByMatriz = filiais.reduce<Record<string, Empresa[]>>((acc, f) => {
    const mid = f.matriz_id!;
    if (!acc[mid]) acc[mid] = [];
    acc[mid].push(f);
    return acc;
  }, {});

  // Empresas sem matriz_id mas que também não são matriz de ninguém ficam na lista normal
  const rows: { empresa: Empresa; isFilial: boolean }[] = [];
  for (const m of matrizes) {
    rows.push({ empresa: m, isFilial: false });
    for (const f of filiaisByMatriz[m.id] ?? []) {
      rows.push({ empresa: f, isFilial: true });
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Empresas</h1>
        <Link
          href="/dashboard/empresas/nova"
          style={{ background: "#2563eb", color: "white", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          + Nova empresa
        </Link>
      </div>
      {!empresas.length ? (
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
            {rows.map(({ empresa: e, isFilial }) => (
              <tr key={e.id} style={{ borderTop: "1px solid #e5e7eb", background: isFilial ? "#fafafa" : undefined }}>
                <td style={{ ...td, paddingLeft: isFilial ? 32 : 16 }}>
                  {isFilial && <span style={{ color: "#9ca3af", marginRight: 6, fontSize: 11 }}>↳</span>}
                  {e.codigo}
                </td>
                <td style={td}>{anonimizado ? "XX.XXX.XXX/XXXX-XX" : e.cnpj}</td>
                <td style={td}>
                  {anonimizado ? `Empresa ${e.codigo}` : e.nome}
                  {!isFilial && (filiaisByMatriz[e.id]?.length ?? 0) > 0 && (
                    <>
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#1d4ed8", background: "#dbeafe", borderRadius: 4, padding: "1px 7px", fontWeight: 600 }}>
                        MATRIZ
                      </span>
                      <span style={{ marginLeft: 4, fontSize: 11, color: "#6b7280", background: "#f3f4f6", borderRadius: 4, padding: "1px 6px" }}>
                        {filiaisByMatriz[e.id].length} filial{filiaisByMatriz[e.id].length !== 1 ? "is" : ""}
                      </span>
                    </>
                  )}
                  {isFilial && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#6b7280", background: "#f3f4f6", borderRadius: 4, padding: "1px 6px" }}>
                      Filial
                    </span>
                  )}
                </td>
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
