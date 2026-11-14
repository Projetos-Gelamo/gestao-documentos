"use client";
import { useAnon } from "./AnonContext";

export default function AnonToggle() {
  const { anonimizado, toggleAnon } = useAnon();

  return (
    <button
      onClick={toggleAnon}
      title={anonimizado ? "Desativar modo anonimizado" : "Anonimizar todos os dados"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        background: anonimizado ? "#fef3c7" : "transparent",
        border: anonimizado ? "1px solid #fde68a" : "1px solid #e5e7eb",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: anonimizado ? 700 : 400,
        color: anonimizado ? "#92400e" : "#6b7280",
        transition: "all .15s",
      }}
    >
      <span>{anonimizado ? "🔒" : "👁"}</span>
      <span>{anonimizado ? "Anonimizado" : "Anonimizar"}</span>
    </button>
  );
}
