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
  duplicata_de: string | null;
  cnpj_empresa_esperado: string | null;
};

type QueueItem = {
  file: File;
  status: "aguardando" | "processando" | "concluido" | "erro";
  result?: UploadResult;
  error?: string;
};

export default function UploadForm({ empresaId, empresaNome }: { empresaId: string; empresaNome: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);

  function addFiles(files: FileList | File[]) {
    const novos: QueueItem[] = Array.from(files).map((f) => ({
      file: f,
      status: "aguardando",
    }));
    setQueue((prev) => [...prev, ...novos]);
  }

  async function processarFila(filaInicial: QueueItem[]) {
    setRunning(true);
    const fila = [...filaInicial];

    for (let i = 0; i < fila.length; i++) {
      if (fila[i].status !== "aguardando") continue;

      // marca como processando
      setQueue((prev) =>
        prev.map((item, idx) =>
          item.file === fila[i].file ? { ...item, status: "processando" } : item
        )
      );

      try {
        const form = new FormData();
        form.append("empresa_id", empresaId);
        form.append("file", fila[i].file);
        const res = await fetch(`${API}/upload/`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Erro ao processar");

        setQueue((prev) =>
          prev.map((item) =>
            item.file === fila[i].file ? { ...item, status: "concluido", result: data } : item
          )
        );
      } catch (e: any) {
        setQueue((prev) =>
          prev.map((item) =>
            item.file === fila[i].file ? { ...item, status: "erro", error: e.message } : item
          )
        );
      }
    }
    setRunning(false);
  }

  function iniciarUpload() {
    const aguardando = queue.filter((q) => q.status === "aguardando");
    if (!aguardando.length) return;
    processarFila(queue);
  }

  function removerItem(file: File) {
    setQueue((prev) => prev.filter((q) => q.file !== file));
  }

  function limparConcluidos() {
    setQueue((prev) => prev.filter((q) => q.status === "aguardando" || q.status === "processando"));
  }

  const total = queue.length;
  const concluidos = queue.filter((q) => q.status === "concluido" || q.status === "erro").length;
  const aguardando = queue.filter((q) => q.status === "aguardando").length;
  const processando = queue.filter((q) => q.status === "processando").length;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/dashboard/empresas/${empresaId}`} style={{ fontSize: 13, color: "#c4a030", textDecoration: "none" }}>
          ← {empresaNome}
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: "#0c1a2e" }}>Enviar documentos</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          Selecione um ou vários arquivos. PDF, imagem, XML, OFX, Excel. A IA lê e classifica automaticamente.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        style={{
          border: "2px dashed #c4a030",
          borderRadius: 10,
          padding: "28px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: "#faf8f4",
          transition: "background .15s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.bmp,.xml,.ofx,.ofc,.xlsx,.xls,.csv"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
        <p style={{ fontSize: 32, marginBottom: 8 }}>📂</p>
        <p style={{ color: "#0c1a2e", fontWeight: 600, fontSize: 15 }}>Arraste arquivos aqui ou clique para selecionar</p>
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Vários arquivos de uma vez — PDF, Excel, XML, OFX, imagens</p>
      </div>

      {/* Barra de ação */}
      {queue.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={iniciarUpload}
            disabled={running || aguardando === 0}
            style={{
              padding: "10px 24px",
              background: running || aguardando === 0 ? "#e5e7eb" : "#0c1a2e",
              color: running || aguardando === 0 ? "#9ca3af" : "#c4a030",
              border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14,
              cursor: running || aguardando === 0 ? "not-allowed" : "pointer",
            }}
          >
            {running
              ? `Processando ${concluidos + 1} de ${total}…`
              : aguardando === 0
              ? "Tudo processado"
              : `Enviar ${aguardando} arquivo${aguardando > 1 ? "s" : ""}`}
          </button>
          {concluidos > 0 && !running && (
            <button
              onClick={limparConcluidos}
              style={{ padding: "10px 16px", background: "transparent", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, color: "#6b7280", cursor: "pointer" }}
            >
              Limpar concluídos
            </button>
          )}
          <span style={{ fontSize: 13, color: "#6b7280", marginLeft: "auto" }}>
            {concluidos}/{total} concluído{concluidos !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Barra de progresso geral */}
      {total > 0 && (
        <div style={{ marginTop: 10, height: 4, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${total > 0 ? (concluidos / total) * 100 : 0}%`,
            background: "#c4a030",
            transition: "width .3s",
          }} />
        </div>
      )}

      {/* Lista da fila */}
      {queue.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {queue.map((item, idx) => (
            <QueueRow
              key={`${item.file.name}-${idx}`}
              item={item}
              index={idx + 1}
              total={total}
              onRemove={() => removerItem(item.file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueRow({ item, index, total, onRemove }: {
  item: QueueItem;
  index: number;
  total: number;
  onRemove: () => void;
}) {
  const { file, status, result, error } = item;

  const statusConfig = {
    aguardando:   { icon: "⏳", color: "#9ca3af", bg: "#f9fafb",  label: "Aguardando" },
    processando:  { icon: "⚙️", color: "#2563eb", bg: "#eff6ff",  label: "Processando…" },
    concluido:    { icon: result?.status === "empresa_errada" ? "🚨"
                       : result?.status === "duplicata" ? "⚠"
                       : result?.status === "nao_reconhecido" ? "⚠"
                       : "✓",
                   color: result?.status === "empresa_errada" ? "#b91c1c"
                       : result?.status === "duplicata" ? "#c2410c"
                       : result?.status === "nao_reconhecido" ? "#d97706"
                       : "#16a34a",
                   bg: result?.status === "empresa_errada" ? "#fef2f2"
                       : result?.status === "duplicata" ? "#fff7ed"
                       : result?.status === "nao_reconhecido" ? "#fefce8"
                       : "#f0fdf4",
                   label: result?.status === "empresa_errada" ? "Empresa errada"
                       : result?.status === "duplicata" ? "Duplicata"
                       : result?.status === "nao_reconhecido" ? "Não identificado"
                       : "Classificado" },
    erro:         { icon: "✗", color: "#b91c1c", bg: "#fef2f2",  label: "Erro" },
  }[status];

  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: statusConfig.bg,
      border: `1px solid ${status === "concluido" && result?.status === "empresa_errada" ? "#fca5a5"
        : status === "concluido" && result?.status === "duplicata" ? "#fed7aa"
        : "#e5e7eb"}`,
      borderRadius: 8, padding: "10px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Número */}
        <span style={{ fontSize: 11, color: "#9ca3af", width: 32, flexShrink: 0, textAlign: "right" }}>
          {index}/{total}
        </span>

        {/* Ícone status */}
        <span style={{ fontSize: status === "processando" ? 16 : 14, color: statusConfig.color, flexShrink: 0 }}>
          {statusConfig.icon}
        </span>

        {/* Nome do arquivo */}
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file.name}
        </span>

        {/* Label status */}
        <span style={{ fontSize: 12, color: statusConfig.color, fontWeight: 600, flexShrink: 0 }}>
          {statusConfig.label}
        </span>

        {/* Botões */}
        {status === "concluido" && result && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
        {status === "aguardando" && (
          <button onClick={onRemove} style={{ fontSize: 13, color: "#9ca3af", background: "transparent", border: "none", cursor: "pointer", padding: "0 4px" }}>
            ✕
          </button>
        )}
      </div>

      {/* Detalhe do resultado */}
      {expanded && result && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
          {result.status === "empresa_errada" && (
            <div style={{ background: "#fee2e2", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#7f1d1d", marginBottom: 8 }}>
              <strong>CNPJ no documento:</strong> {result.cnpj}<br />
              <strong>CNPJ desta empresa:</strong> {result.cnpj_empresa_esperado}<br />
              Verifique se este arquivo pertence a outra empresa.
            </div>
          )}
          {result.status === "duplicata" && (
            <div style={{ background: "#ffedd5", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#9a3412", marginBottom: 8 }}>
              Já existe um documento do mesmo tipo, banco e mês registrado. Salvo como duplicata.
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 24px" }}>
            {result.tipo && <Detail label="Tipo" value={TIPO_LABEL[result.tipo] ?? result.tipo} />}
            {result.banco && <Detail label="Banco" value={result.banco} />}
            {result.conta && <Detail label="Conta" value={result.conta} />}
            {result.mes_referencia && <Detail label="Mês ref." value={_mesPtBR(result.mes_referencia)} />}
            <Detail label="Confiança" value={`${(result.confidence * 100).toFixed(0)}%`} />
            {result.nome_sugerido && result.status !== "empresa_errada" && (
              <Detail label="Nome sugerido" value={result.nome_sugerido} highlight />
            )}
          </div>
        </div>
      )}

      {/* Erro */}
      {status === "erro" && error && (
        <p style={{ fontSize: 12, color: "#b91c1c", marginTop: 6 }}>{error}</p>
      )}
    </div>
  );
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ fontSize: 12 }}>
      <span style={{ color: "#9ca3af" }}>{label}: </span>
      <span style={{ fontWeight: highlight ? 700 : 400, color: highlight ? "#15803d" : "#374151" }}>{value}</span>
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
