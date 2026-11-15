"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

const TIPOS_DOC = [
  { value: "extrato_bancario",      label: "Extrato Bancário" },
  { value: "nota_fiscal",           label: "Nota Fiscal" },
  { value: "guia_pagamento",        label: "Guia de Pagamento" },
  { value: "contrato",              label: "Contrato" },
  { value: "recibo",                label: "Recibo" },
  { value: "balancete",             label: "Balancete" },
  { value: "dre",                   label: "DRE" },
  { value: "folha_pagamento",       label: "Folha de Pagamento" },
  { value: "comprovante_pagamento", label: "Comprovante de Pagamento" },
  { value: "contrato_emprestimo",   label: "Contrato de Empréstimo" },
  { value: "planilha_financeira",   label: "Planilha Financeira" },
  { value: "outros",                label: "Outros" },
];

type Empresa = { id: string; nome: string; cnpj: string; codigo: string };

type ContaBancaria = {
  id: string; banco: string; agencia: string | null;
  conta: string; tipo: string; cnpj: string | null; ativo: boolean;
};

type DocumentoEsperado = {
  id: string; tipo: string; descricao: string; frequencia: string; ativo: boolean;
  conta_bancaria_id: string | null;
  conta_bancaria?: { id: string; banco: string; conta: string; tipo: string } | null;
};

type Pendencia = DocumentoEsperado & { mes_referencia: string; recebido: boolean; documento_id: string | null };

type Aba = "contas" | "docs" | "pendencias";

export default function ConfiguracoesClient({ empresa }: { empresa: Empresa }) {
  const [aba, setAba] = useState<Aba>("contas");
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [docs, setDocs] = useState<DocumentoEsperado[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesPend, setMesPend] = useState(() => {
    const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });

  useEffect(() => { carregarContas(); carregarDocs(); }, []);
  useEffect(() => { if (aba === "pendencias") carregarPendencias(); }, [aba, mesPend]);

  async function carregarContas() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/empresas/${empresa.id}/contas-bancarias`);
      setContas(r.ok ? await r.json() : []);
    } catch { setContas([]); }
    finally { setLoading(false); }
  }

  async function carregarDocs() {
    try {
      const r = await fetch(`${API}/empresas/${empresa.id}/documentos-esperados`);
      setDocs(r.ok ? await r.json() : []);
    } catch { setDocs([]); }
  }

  async function carregarPendencias() {
    try {
      const r = await fetch(`${API}/empresas/${empresa.id}/pendencias/${mesPend.ano}/${mesPend.mes}`);
      setPendencias(r.ok ? await r.json() : []);
    } catch { setPendencias([]); }
  }

  const totalPend = pendencias.filter((p) => !p.recebido).length;

  return (
    <div style={{ maxWidth: 820, padding: "32px 24px" }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <Link href={`/dashboard/empresas/${empresa.id}`}
          style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
          ← {empresa.nome}
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0c1a2e", margin: 0 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Contas bancárias e documentos esperados mensalmente</p>
      </div>

      {/* Abas */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", marginBottom: 24 }}>
        {([
          { key: "contas",     label: "Contas bancárias" },
          { key: "docs",       label: "Documentos esperados" },
          { key: "pendencias", label: "Pendências do mês", badge: totalPend > 0 ? totalPend : null },
        ] as { key: Aba; label: string; badge?: number | null }[]).map(({ key, label, badge }) => (
          <button key={key} onClick={() => setAba(key)}
            style={{ padding: "9px 18px", fontSize: 13, background: "none", border: "none",
              borderBottom: `2px solid ${aba === key ? "#c4a030" : "transparent"}`,
              color: aba === key ? "#c4a030" : "#6b7280", fontWeight: aba === key ? 700 : 400,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {label}
            {badge != null && (
              <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Aba: Contas bancárias ── */}
      {aba === "contas" && (
        <ContasAba empresaId={empresa.id} contas={contas} loading={loading} onRefresh={carregarContas} />
      )}

      {/* ── Aba: Documentos esperados ── */}
      {aba === "docs" && (
        <DocsAba empresaId={empresa.id} docs={docs} contas={contas} onRefresh={carregarDocs} />
      )}

      {/* ── Aba: Pendências ── */}
      {aba === "pendencias" && (
        <PendenciasAba pendencias={pendencias} mesPend={mesPend} setMesPend={setMesPend} />
      )}
    </div>
  );
}

// ── Aba Contas ──────────────────────────────────────────────────────────────

function ContasAba({ empresaId, contas, loading, onRefresh }: {
  empresaId: string; contas: ContaBancaria[]; loading: boolean; onRefresh: () => void;
}) {
  const [form, setForm] = useState<Partial<ContaBancaria> | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function salvar() {
    if (!form?.banco || !form?.conta) return;
    setSalvando(true);
    try {
      const url = form.id
        ? `${API}/empresas/${empresaId}/contas-bancarias/${form.id}`
        : `${API}/empresas/${empresaId}/contas-bancarias`;
      await fetch(url, { method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setForm(null);
      onRefresh();
    } finally { setSalvando(false); }
  }

  async function deletar(id: string) {
    if (!confirm("Remover esta conta?")) return;
    await fetch(`${API}/empresas/${empresaId}/contas-bancarias/${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setImportando(true);
    const fd = new FormData(); fd.append("file", f);
    try {
      const r = await fetch(`${API}/empresas/${empresaId}/importar-contas`, { method: "POST", body: fd });
      const d = await r.json();
      alert(`Importadas: ${d.inseridos} contas.${d.erros?.length ? `\nErros: ${d.erros.join("\n")}` : ""}`);
      onRefresh();
    } finally { setImportando(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  const TIPO_LABEL: Record<string, string> = { corrente: "Corrente", poupanca: "Poupança", investimento: "Investimento" };

  return (
    <div>
      <InfoBox>As contas cadastradas aqui ajudam a IA a identificar automaticamente de qual empresa é cada documento no upload.</InfoBox>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
          {loading ? "Carregando…" : `${contas.length} conta${contas.length !== 1 ? "s" : ""} cadastrada${contas.length !== 1 ? "s" : ""}`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importar} />
          <BtnSecondary onClick={() => fileRef.current?.click()} loading={importando}>
            Importar planilha
          </BtnSecondary>
          <BtnPrimary onClick={() => setForm({ tipo: "corrente", ativo: true })}>+ Adicionar conta</BtnPrimary>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
        Formato da planilha: Banco | Agência | Conta | Tipo | CNPJ{" — "}
        <a href={`${API}/templates/contas-bancarias.xlsx`} download style={{ color: "#2563eb" }}>
          ⬇ Baixar modelo
        </a>
      </p>

      {form !== null && (
        <div style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#374151" }}>
            {form.id ? "Editar conta" : "Nova conta bancária"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="Banco *">
              <input value={form.banco ?? ""} onChange={(e) => setForm({ ...form, banco: e.target.value })}
                placeholder="ex: Itaú" style={inputStyle} />
            </Field>
            <Field label="Agência">
              <input value={form.agencia ?? ""} onChange={(e) => setForm({ ...form, agencia: e.target.value })}
                placeholder="ex: 0143" style={inputStyle} />
            </Field>
            <Field label="Conta *">
              <input value={form.conta ?? ""} onChange={(e) => setForm({ ...form, conta: e.target.value })}
                placeholder="ex: 11810-7" style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Field label="Tipo">
              <select value={form.tipo ?? "corrente"} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="investimento">Investimento</option>
              </select>
            </Field>
            <Field label="CNPJ (se diferente da empresa)">
              <input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                placeholder="ex: 02.221.511/0002-40" style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <BtnPrimary onClick={salvar} loading={salvando}>{form.id ? "Salvar" : "Adicionar"}</BtnPrimary>
            <BtnSecondary onClick={() => setForm(null)}>Cancelar</BtnSecondary>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {contas.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.banco}</span>
                <Badge color="blue">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                {!c.ativo && <Badge color="gray">Inativa</Badge>}
              </div>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {c.agencia ? `Ag. ${c.agencia} · ` : ""}CC: {c.conta}{c.cnpj ? ` · CNPJ: ${c.cnpj}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <BtnIcon onClick={() => setForm({ ...c })} />
              <BtnIcon onClick={() => deletar(c.id)} danger />
            </div>
          </div>
        ))}
        {!loading && contas.length === 0 && (
          <EmptyState>Nenhuma conta cadastrada. Adicione manualmente ou importe uma planilha.</EmptyState>
        )}
      </div>
    </div>
  );
}

// ── Aba Documentos Esperados ────────────────────────────────────────────────

function DocsAba({ empresaId, docs, contas, onRefresh }: {
  empresaId: string; docs: DocumentoEsperado[]; contas: ContaBancaria[]; onRefresh: () => void;
}) {
  const [form, setForm] = useState<Partial<DocumentoEsperado> | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const FREQ_LABEL: Record<string, string> = { mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" };

  async function salvar() {
    if (!form?.tipo || !form?.descricao) return;
    setSalvando(true);
    try {
      const url = form.id
        ? `${API}/empresas/${empresaId}/documentos-esperados/${form.id}`
        : `${API}/empresas/${empresaId}/documentos-esperados`;
      await fetch(url, { method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setForm(null);
      onRefresh();
    } finally { setSalvando(false); }
  }

  async function deletar(id: string) {
    if (!confirm("Remover este documento esperado?")) return;
    await fetch(`${API}/empresas/${empresaId}/documentos-esperados/${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setImportando(true);
    const fd = new FormData(); fd.append("file", f);
    try {
      const r = await fetch(`${API}/empresas/${empresaId}/importar-documentos`, { method: "POST", body: fd });
      const d = await r.json();
      alert(`Importados: ${d.inseridos} documentos.${d.erros?.length ? `\nErros: ${d.erros.join("\n")}` : ""}`);
      onRefresh();
    } finally { setImportando(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div>
      <InfoBox>Defina quais documentos a empresa deve entregar todo mês. O sistema marcará automaticamente quando cada um chegar.</InfoBox>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
          {docs.length} documento{docs.length !== 1 ? "s" : ""} esperado{docs.length !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importar} />
          <BtnSecondary onClick={() => fileRef.current?.click()} loading={importando}>Importar planilha</BtnSecondary>
          <BtnPrimary onClick={() => setForm({ tipo: "extrato_bancario", frequencia: "mensal", ativo: true })}>+ Adicionar</BtnPrimary>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
        Formato da planilha: Tipo | Banco | Agência | Conta | Descrição | Frequência{" — "}
        <a href={`${API}/templates/documentos-esperados.xlsx`} download style={{ color: "#2563eb" }}>
          ⬇ Baixar modelo
        </a>
      </p>

      {form !== null && (
        <div style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#374151" }}>
            {form.id ? "Editar documento esperado" : "Novo documento esperado"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="Tipo *">
              <select value={form.tipo ?? ""} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                {TIPOS_DOC.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Frequência">
              <select value={form.frequencia ?? "mensal"} onChange={(e) => setForm({ ...form, frequencia: e.target.value })} style={inputStyle}>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Field label="Descrição *">
              <input value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="ex: Extrato Itaú CC 11810-7" style={inputStyle} />
            </Field>
            <Field label="Conta vinculada (opcional)">
              <select value={form.conta_bancaria_id ?? ""} onChange={(e) => setForm({ ...form, conta_bancaria_id: e.target.value || null })} style={inputStyle}>
                <option value="">— Sem conta vinculada —</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.banco} CC {c.conta}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <BtnPrimary onClick={salvar} loading={salvando}>{form.id ? "Salvar" : "Adicionar"}</BtnPrimary>
            <BtnSecondary onClick={() => setForm(null)}>Cancelar</BtnSecondary>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{d.descricao}</span>
                <Badge color="blue">{FREQ_LABEL[d.frequencia] ?? d.frequencia}</Badge>
                {!d.ativo && <Badge color="gray">Inativo</Badge>}
              </div>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Tipo: {TIPOS_DOC.find((t) => t.value === d.tipo)?.label ?? d.tipo}
                {d.conta_bancaria ? ` · Conta: ${d.conta_bancaria.banco} CC ${d.conta_bancaria.conta}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <BtnIcon onClick={() => setForm({ ...d, conta_bancaria_id: d.conta_bancaria_id })} />
              <BtnIcon onClick={() => deletar(d.id)} danger />
            </div>
          </div>
        ))}
        {docs.length === 0 && (
          <EmptyState>Nenhum documento esperado cadastrado. Adicione manualmente ou importe uma planilha.</EmptyState>
        )}
      </div>
    </div>
  );
}

// ── Aba Pendências ──────────────────────────────────────────────────────────

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function PendenciasAba({ pendencias, mesPend, setMesPend }: {
  pendencias: Pendencia[];
  mesPend: { ano: number; mes: number };
  setMesPend: (v: { ano: number; mes: number }) => void;
}) {
  const recebidos = pendencias.filter((p) => p.recebido);
  const pendentes = pendencias.filter((p) => !p.recebido);

  function navMes(delta: number) {
    let { ano, mes } = mesPend;
    mes += delta;
    if (mes < 1) { mes = 12; ano--; }
    if (mes > 12) { mes = 1; ano++; }
    setMesPend({ ano, mes });
  }

  return (
    <div>
      {/* Navegação de mês */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => navMes(-1)} style={navBtnStyle}>←</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 160, textAlign: "center" }}>
          {MESES[mesPend.mes - 1]} / {mesPend.ano}
        </span>
        <button onClick={() => navMes(1)} style={navBtnStyle}>→</button>
        {pendentes.length > 0 && (
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "#92400e",
            background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 20, padding: "3px 10px" }}>
            {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
          </span>
        )}
        {pendentes.length === 0 && pendencias.length > 0 && (
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "#16a34a",
            background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "3px 10px" }}>
            Tudo recebido
          </span>
        )}
      </div>

      {pendencias.length === 0 ? (
        <EmptyState>Nenhum documento esperado cadastrado. Configure na aba "Documentos esperados".</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pendencias.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
              background: p.recebido ? "#f0fdf4" : "#fff", border: `1px solid ${p.recebido ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: p.recebido ? "#16a34a" : "#d1d5db" }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: p.recebido ? "#166534" : "#374151" }}>
                  {p.descricao}
                </span>
                {p.conta_bancaria && (
                  <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 8 }}>
                    {p.conta_bancaria.banco} CC {p.conta_bancaria.conta}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: p.recebido ? "#16a34a" : "#9ca3af" }}>
                {p.recebido ? "Recebido" : "Pendente"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ──────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6,
  fontSize: 13, background: "white", boxSizing: "border-box",
};

const navBtnStyle: React.CSSProperties = {
  padding: "5px 12px", border: "1px solid #d1d5db", borderRadius: 6,
  background: "white", cursor: "pointer", fontSize: 14,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function Badge({ color, children }: { color: "blue" | "amber" | "gray" | "green"; children: React.ReactNode }) {
  const styles = {
    blue:  { background: "#eff6ff", color: "#1e40af" },
    amber: { background: "#fef3c7", color: "#92400e" },
    gray:  { background: "#f3f4f6", color: "#6b7280" },
    green: { background: "#f0fdf4", color: "#166534" },
  }[color];
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, ...styles }}>
      {children}
    </span>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe",
      borderRadius: 8, fontSize: 12, color: "#1e40af", marginBottom: 16, display: "flex", gap: 8 }}>
      ℹ {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 24, background: "#f9fafb", borderRadius: 10, fontSize: 13, color: "#6b7280", textAlign: "center" }}>
      {children}
    </div>
  );
}

function BtnPrimary({ onClick, loading, children }: { onClick: () => void; loading?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding: "7px 16px", background: "#c4a030", color: "#0c1a2e", border: "none",
        borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
      {loading ? "Aguarde…" : children}
    </button>
  );
}

function BtnSecondary({ onClick, loading, children }: { onClick: () => void; loading?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding: "7px 14px", background: "white", color: "#374151", border: "1px solid #d1d5db",
        borderRadius: 6, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
      {loading ? "Aguarde…" : children}
    </button>
  );
}

function BtnIcon({ onClick, danger }: { onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ padding: "4px 8px", background: "white", color: danger ? "#b91c1c" : "#6b7280",
        border: `1px solid ${danger ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
      {danger ? "✕" : "✎"}
    </button>
  );
}
