import Link from "next/link";

export default function RevisaoPage() {
  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Fila de Revisão</h1>
      <div style={{ padding: 20, background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10 }}>
        <p style={{ fontSize: 14, color: "#713f12", fontWeight: 600, marginBottom: 8 }}>
          Esta seção foi integrada à tela de cada empresa.
        </p>
        <p style={{ fontSize: 13, color: "#92400e", marginBottom: 16 }}>
          Acesse a empresa desejada e veja a seção <strong>Revisão pendente</strong> na aba Contábil.
          Lá você pode classificar documentos não identificados, mover documentos para a empresa certa
          e excluir duplicatas.
        </p>
        <Link
          href="/dashboard/empresas"
          style={{ padding: "9px 18px", background: "#c4a030", color: "#0c1a2e", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
        >
          Ir para Empresas
        </Link>
      </div>
    </div>
  );
}
