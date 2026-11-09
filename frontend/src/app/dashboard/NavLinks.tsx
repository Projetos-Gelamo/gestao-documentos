"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Início" },
  { href: "/dashboard/empresas", label: "Empresas" },
  { href: "/dashboard/revisao", label: "Fila de Revisão" },
  { href: "/dashboard/relatorios", label: "Relatórios" },
  { href: "/dashboard/configuracoes", label: "Configurações" },
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <>
      {links.map(({ href, label }) => {
        const active = path === href || (href !== "/dashboard" && path.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "block",
              padding: "9px 14px",
              borderRadius: 6,
              fontSize: 14,
              textDecoration: "none",
              fontWeight: active ? 600 : 400,
              color: active ? "#c4a030" : "#8ea8c8",
              background: active ? "rgba(196,160,48,0.10)" : "transparent",
              borderLeft: active ? "2px solid #c4a030" : "2px solid transparent",
              transition: "all .15s",
            }}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
