"use client";
import { useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gestao-documentos-production.up.railway.app";

const TIPO_LABEL: Record<string, string> = {
  extrato_bancario: "Extrato Bancário",
  nota_fiscal: "Nota Fiscal",
  guia_pagamento: "Guia de Pagamento",
  contrato: "Contrato",
  recibo: "Recibo",
  balancete: "Balancete",
  dre: "DRE",
  folha_pagamento: "Folha de Pagamento",
  comprovante_pagamento: "Comprovante de Pagamento",
  contrato_emprestimo: "Contrato de Empréstimo",
  planilha_financeira: "Planilha Financeira",
  outros: "Outros",
};

type UploadResult = {
  id: string;
  nome_arquivo: string;
  tipo: string | null;
  mes_referencia: string | null;
  banco: string | null;
  conta: string | null;
  cnpj: string | null;
  confidence: number;
  status: string;
  na_fila_revisao: boolean;
  nome_sugerido: string | null;
};

export default function UploadForm({ empresaId, empresaNome }: { empresaId: string; empresaNome: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

  function handleFileChange(f: File | null) {
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("empresa_id", empresaId);
      form.append("file", file);
      const res = await fetch(`${API}/upload/`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro ao processar arquivo");
      setResult(data);
      setResults((prev) => [data, ...prev]);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/dashboard/empresas/${empresaId}`} style={{ fontSize: 13, color: "#2563eb" }}>
          ← {empresaNome}
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>Enviar documento</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          PDF, imagem, XML, OFX, Excel. O sistema lê e classifica automaticamente.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFileChange(f);
        }}
        style={{
          border: "2px dashed #d1d5db",
          borderRadius: 10,
          padding: 32,
          textAlign: "center",
          cursor: "pointer",
          background: file ? "#f0fdf4" : "#fafafa",
          borderColor: file ? "#16a34a" : "#d1d5db",
          transition: "all .15s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          style={{ display: "none" }}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.bmp,.xml,.ofx,.ofc,.xlsx,.xls,.csv"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div>
            <p style={{ fontWeight: 600, color: "#15803d" }}>{file.name}</p>
            <p style={{ fontSize: 12, color: "#6b7280" }}>{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        ) : (
          <p style={{ color: "#6b7280", fontSize: 14 }}>Arraste um arquivo ou clique para selecionar</p>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "10px 0",
          borderRadius: 8,
          border: "none",
          background: !file || loading ? "#e5e7eb" : "#2563eb",
          color: !file || loading ? "#9ca3af" : "white",
          fontWeight: 600,
          fontSize: 15,
          cursor: !file || loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Lendo documento..." : "Analisar e salvar"}
      </button>

      {error && (
        <div style={{ marginTop: 16, background: "#fee2e2", borderRadius: 8, padding: 14, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && <ResultCard result={result} />}

      {results.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Enviados nesta sessão ({results.length})</p>
          {results.map((r) => (
            <div key={r.id} style={{ padding: "8px 12px", background: "white", borderRadius: 6, marginBottom: 6, fontSize: 13, display: "flex", justifyContent: "space-between", boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
              <span>{r.nome_arquivo}</span>
              <span style={{ color: r.na_fila_revisao ? "#f59e0b" : "#16a34a", fontWeight: 500 }}>
                {r.na_fila_revisao ? "⚠ Revisão" : "✓ " + (TIPO_LABEL[r.tipo ?? ""] ?? r.tipo ?? "—")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ result }: { result: UploadResult }) {
  const bg = result.na_fila_revisao ? "#fef3c7" : "#f0fdf4";
  const border = result.na_fila_revisao ? "#fde68a" : "#bbf7d0";
  return (
    <div style={{ marginTop: 20, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: 20 }}>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
        {result.na_fila_revisao ? "⚠ Não identificado — aguarda revisão" : "✓ Documento classificado"}
      </p>
      <Row label="Arquivo" value={result.nome_arquivo} />
      <Row label="Tipo identificado" value={result.tipo ? (TIPO_LABEL[result.tipo] ?? result.tipo) : "—"} />
      {result.banco && <Row label="Banco" value={result.banco} />}
      {result.conta && <Row label="Conta" value={result.conta} />}
      <Row label="Período" value={result.mes_referencia ? _mesPtBR(result.mes_referencia) : "—"} />
      {result.nome_sugerido && <Row label="Nome sugerido" value={result.nome_sugerido} highlight />}
      <Row label="Confiança" value={`${(result.confidence * 100).toFixed(0)}%`} />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: "#6b7280", width: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: highlight ? 700 : 400, color: highlight ? "#15803d" : "#111" }}>{value}</span>
    </div>
  );
}

const _MESES: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
  "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
  "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
};

function _mesPtBR(mes: string) {
  if (mes.length !== 7) return mes;
  const [ano, m] = mes.split("-");
  return `${_MESES[m] ?? m}/${ano}`;
}
