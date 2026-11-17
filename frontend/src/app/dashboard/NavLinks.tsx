"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links: { href: string; label: string; fullReload?: boolean }[] = [
  { href: "/dashboard", label: "Início" },
  { href: "/dashboard/empresas", label: "Empresas" },
  { href: "/dashboard/fila-global", label: "Aguardando Aprovação", fullReload: true },
  { href: "/dashboard/relatorios", label: "Relatórios" },
  { href: "/dashboard/configuracoes", label: "Configurações" },
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <>
      {links.map(({ href, label, fullReload }) => {
        const active = path === href || (href !== "/dashboard" && path.startsWith(href));
        const style = {
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
        } as React.CSSProperties;
        return fullReload ? (
          <a key={href} href={href} style={style}>{label}</a>
        ) : (
          <Link key={href} href={href} style={style}>{label}</Link>
        );
      })}
    </>
  );
}
