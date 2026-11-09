"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("E-mail ou senha inválidos.");
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  }

  return (
    <main style={{ display: "flex", minHeight: "100vh" }}>
      {/* Painel esquerdo — marca */}
      <div style={{
        flex: 1,
        background: "linear-gradient(160deg, #0d1f35 0%, #0a1626 60%, #071020 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "60px 56px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Círculo decorativo */}
        <div style={{
          position: "absolute", top: -120, right: -120,
          width: 500, height: 500, borderRadius: "50%",
          border: "1px solid rgba(196,160,48,0.15)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 300, height: 300, borderRadius: "50%",
          border: "1px solid rgba(196,160,48,0.10)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 8,
              border: "1.5px solid #c4a030",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 26, color: "#c4a030", fontFamily: "Georgia, serif",
              background: "rgba(196,160,48,0.06)",
            }}>G</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }}>
                Gélamo <span style={{ color: "#c4a030" }}>Contábil</span>
              </div>
              <div style={{ fontSize: 12, color: "#4a6a8a", letterSpacing: "0.08em", marginTop: 3 }}>
                ASSESSORIA CONTÁBIL E EMPRESARIAL
              </div>
            </div>
          </div>

          <div style={{ borderLeft: "3px solid #c4a030", paddingLeft: 20 }}>
            <p style={{ fontSize: 11, color: "#c4a030", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 12 }}>
              OPERAÇÃO SEGURA
            </p>
            <h1 style={{ fontSize: 42, fontWeight: 700, color: "#ffffff", lineHeight: 1.15, marginBottom: 20 }}>
              Controle<br />contábil com<br />clareza.
            </h1>
            <p style={{ fontSize: 14, color: "#6888a8", lineHeight: 1.7, maxWidth: 360 }}>
              Obrigações, rotinas, documentos e gestão reunidos em um ambiente interno e auditável.
            </p>
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div style={{
        width: 480,
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 56px",
        flexShrink: 0,
      }}>
        <p style={{ fontSize: 11, color: "#c4a030", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 16 }}>
          ACESSO RESTRITO
        </p>
        <h2 style={{ fontSize: 32, fontWeight: 700, color: "#0c1a2e", marginBottom: 8 }}>Bem-vindo</h2>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 36, lineHeight: 1.5 }}>
          Entre com o login ou e-mail fornecido pelo administrador.
        </p>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#b91c1c", marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 8 }}>
              Login ou e-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder=""
              style={{
                width: "100%", padding: "12px 14px",
                border: "1px solid #e5e7eb", borderRadius: 6,
                fontSize: 14, color: "#0c1a2e",
                background: "#f8fafc", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 8 }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%", padding: "12px 14px",
                border: "1px solid #e5e7eb", borderRadius: 6,
                fontSize: 14, color: "#0c1a2e",
                background: "#f8fafc", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              background: loading ? "#1e3a5f" : "#0c1a2e",
              color: "white", border: "none", borderRadius: 6,
              fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.02em", marginTop: 4,
              transition: "background .15s",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 13, color: "#c4a030", cursor: "pointer" }}>Esqueci minha senha</span>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>Suporte: administrador interno</span>
          </div>
        </form>
      </div>
    </main>
  );
}
