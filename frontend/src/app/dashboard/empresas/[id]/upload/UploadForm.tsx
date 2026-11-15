"use client";
import React, { useRef, useState } from "react";
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
const TIPOS_DOC = Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }));

type Step = "selecao" | "scan_loading" | "pre_classif" | "confirm_loading" | "resultados";
type Acao = "salvar_aqui" | "fila_espera" | "baixar";
type RazaoDecisao = "empresa_errada" | "conta_nova" | "incompleto" | "nao_reconhecido";

type ScanArquivo = {
  id: string;
  nome_arquivo: string;
  tipo: string | null;
  banco: string | null;
  conta: string | null;
  cnpj_extraido: string | null;
  mes_referencia: string | null;
  confidence: number;
  status: "aguardando_classificacao" | "nao_reconhecido" | "erro";
  empresa_sugerida_id: string | null;
  empresa_sugerida_nome: string | null;
  conta_nova: boolean;
  erro?: string;
};

type GrupoContas = {
  key: string;
  label: string;
  tipo: string | null;
  banco: string | null;
  conta: string | null;
  documentos: ScanArquivo[];
  razao: RazaoDecisao;
  empresaSugeridaNome: string | null;
  cnpjExtraido: string | null;
};

type ResultadoFinal = {
  id: string;
  nome_arquivo: string;
  tipo: string | null;
  banco: string | null;
  conta: string | null;
  mes_referencia: string | null;
  status: string;
  duplicata_de: string | null;
  duplicata_nome_arquivo?: string | null;
  empresa_id: string;
  cnpj_extraido: string | null;
  confidence: number;
  nome_sugerido?: string | null;
  download_url?: string | null;
};

// ── Componente principal ───────────────────────────────────────────────────

export default function UploadForm({ empresaId, empresaNome }: { empresaId: string; empresaNome: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("selecao");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [scanProgress, setScanProgress] = useState(0);

  const [gruposConfirmados, setGruposConfirmados] = useState<GrupoContas[]>([]);
  const [gruposDecisao, setGruposDecisao] = useState<GrupoContas[]>([]);
  const [naoReconhecidos, setNaoReconhecidos] = useState<ScanArquivo[]>([]);
  const [comErro, setComErro] = useState<ScanArquivo[]>([]);

  const [acoes, setAcoes] = useState<Record<string, Acao>>({});
  const [contasNovas, setContasNovas] = useState<Record<string, boolean>>({});

  const [finalResults, setFinalResults] = useState<ResultadoFinal[]>([]);
  const [previewState, setPreviewState] = useState<{ url: string; nome: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [scanErroGeral, setScanErroGeral] = useState<string | null>(null);

  function addFiles(files: FileList | File[]) {
    setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
  }

  async function handleScan() {
    if (!selectedFiles.length) return;
    setStep("scan_loading");
    setScanProgress(0);
    setScanErroGeral(null);

    const allArquivos: ScanArquivo[] = [];

    // Processa um arquivo por vez para barra de progresso real
    for (let i = 0; i < selectedFiles.length; i++) {
      setScanProgress(i + 1);
      const f = selectedFiles[i];
      const form = new FormData();
      form.append("empresa_id", empresaId);
      form.append("files", f);

      try {
        const res = await fetch(`${API}/upload/scan`, { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          allArquivos.push({
            id: "", nome_arquivo: f.name, tipo: null, banco: null, conta: null,
            cnpj_extraido: null, mes_referencia: null, confidence: 0,
            status: "erro", empresa_sugerida_id: null, empresa_sugerida_nome: null,
            conta_nova: false, erro: err.detail || "Erro ao processar",
          });
        } else {
          const data = await res.json();
          allArquivos.push(...(data.arquivos || []));
        }
      } catch (e: any) {
        allArquivos.push({
          id: "", nome_arquivo: f.name, tipo: null, banco: null, conta: null,
          cnpj_extraido: null, mes_referencia: null, confidence: 0,
          status: "erro", empresa_sugerida_id: null, empresa_sugerida_nome: null,
          conta_nova: false, erro: e.message || "Erro de conexão",
        });
      }
    }

    // Agrupa resultados
    const erros: ScanArquivo[] = [];
    const naoRec: ScanArquivo[] = [];
    const confirmadosMap = new Map<string, GrupoContas>();
    const decisaoMap = new Map<string, GrupoContas>();
    const contasNovasMap: Record<string, boolean> = {};

    for (const arq of allArquivos) {
      if (arq.status === "erro" || arq.erro) { erros.push(arq); continue; }
      if (arq.status === "nao_reconhecido") { naoRec.push(arq); continue; }

      const ehEmpresaErrada = !!arq.empresa_sugerida_id && arq.empresa_sugerida_id !== empresaId;
      const ehIncompleto = arq.tipo === "extrato_bancario" && (!arq.banco || !arq.conta);
      const precisaDecisao = ehEmpresaErrada || arq.conta_nova || ehIncompleto;

      const contaNorm = (arq.conta || "").replace(/[^\d]/g, "");
      const bancoNorm = (arq.banco || "").toLowerCase().trim();
      const key = bancoNorm && contaNorm
        ? `${bancoNorm}|${contaNorm}`
        : `doc_${(arq.cnpj_extraido || "").replace(/\D/g, "") || arq.id || arq.nome_arquivo}`;

      const tLabel = TIPO_LABEL[arq.tipo ?? ""] ?? "Documento";
      const label = arq.banco && arq.conta
        ? `${tLabel} — ${arq.banco} CC ${arq.conta}`
        : arq.banco ? `${tLabel} — ${arq.banco}` : tLabel;

      if (!precisaDecisao) {
        if (!confirmadosMap.has(key)) {
          confirmadosMap.set(key, {
            key, label, tipo: arq.tipo, banco: arq.banco, conta: arq.conta,
            documentos: [], razao: "conta_nova",
            empresaSugeridaNome: null, cnpjExtraido: null,
          });
        }
        confirmadosMap.get(key)!.documentos.push(arq);
      } else {
        const razao: RazaoDecisao = ehEmpresaErrada ? "empresa_errada" : ehIncompleto ? "incompleto" : "conta_nova";
        if (!decisaoMap.has(key)) {
          decisaoMap.set(key, {
            key, label, tipo: arq.tipo, banco: arq.banco, conta: arq.conta,
            documentos: [], razao,
            empresaSugeridaNome: arq.empresa_sugerida_nome ?? null,
            cnpjExtraido: arq.cnpj_extraido ?? null,
          });
          contasNovasMap[key] = arq.conta_nova;
        }
        decisaoMap.get(key)!.documentos.push(arq);
      }
    }

    setGruposConfirmados(Array.from(confirmadosMap.values()));
    setGruposDecisao(Array.from(decisaoMap.values()));
    setNaoReconhecidos(naoRec);
    setComErro(erros);
    setAcoes({});
    setContasNovas(contasNovasMap);
    setStep("pre_classif");
  }

  const totalDecisao = gruposDecisao.length + naoReconhecidos.length;
  const totalComAcao = Object.keys(acoes).length;
  const podeContinuar = totalDecisao === 0 || totalComAcao >= totalDecisao;

  async function handleConfirmar() {
    setStep("confirm_loading");

    const mapeamentos: { documento_id: string; acao: Acao; is_nova_conta?: boolean }[] = [];

    for (const grupo of gruposConfirmados) {
      for (const doc of grupo.documentos) {
        mapeamentos.push({ documento_id: doc.id, acao: "salvar_aqui", is_nova_conta: doc.conta_nova });
      }
    }
    for (const grupo of gruposDecisao) {
      const acao = acoes[grupo.key] ?? "salvar_aqui";
      const isNova = contasNovas[grupo.key] ?? false;
      for (const doc of grupo.documentos) {
        mapeamentos.push({ documento_id: doc.id, acao, is_nova_conta: acao === "salvar_aqui" ? isNova : false });
      }
    }
    for (const doc of naoReconhecidos) {
      const acao = acoes[doc.id] ?? "salvar_aqui";
      mapeamentos.push({ documento_id: doc.id, acao, is_nova_conta: false });
    }

    try {
      const res = await fetch(`${API}/upload/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, mapeamentos }),
      });
      const data = await res.json();
      setFinalResults(data.resultados || []);
      setStep("resultados");
    } catch {
      alert("Erro ao confirmar. Tente novamente.");
      setStep("pre_classif");
    }
  }

  function resetar() {
    setSelectedFiles([]);
    setGruposConfirmados([]);
    setGruposDecisao([]);
    setNaoReconhecidos([]);
    setComErro([]);
    setFinalResults([]);
    setAcoes({});
    setContasNovas({});
    setScanErroGeral(null);
    setScanProgress(0);
    setStep("selecao");
  }

  async function handlePreview(docId: string) {
    setPreviewLoading(docId);
    try {
      const r = await fetch(`${API}/documentos/${docId}/preview`);
      const data = await r.json();
      if (data.url) setPreviewState({ url: data.url, nome: data.nome_arquivo || "" });
      else alert("Não foi possível carregar o arquivo.");
    } catch { alert("Erro ao carregar preview."); }
    finally { setPreviewLoading(null); }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/dashboard/empresas/${empresaId}`} style={{ fontSize: 13, color: "#c4a030", textDecoration: "none" }}>
          ← {empresaNome}
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: "#0c1a2e" }}>Enviar documentos</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          Selecione os arquivos — a IA extrai e classifica automaticamente.
        </p>
      </div>

      <StepBar step={step} />

      {/* ── Etapa 1: Seleção ── */}
      {(step === "selecao" || step === "scan_loading") && (
        <div>
          <div
            onClick={() => step === "selecao" && inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (step === "selecao" && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
            style={{ border: "2px dashed #c4a030", borderRadius: 10, padding: "28px 20px", textAlign: "center", cursor: step === "selecao" ? "pointer" : "default", background: "#faf8f4" }}
          >
            <input ref={inputRef} type="file" multiple style={{ display: "none" }}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.bmp,.xml,.ofx,.ofc,.xlsx,.xls,.csv"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />

            {step === "scan_loading" ? (
              <>
                <p style={{ fontSize: 28, marginBottom: 10 }}>⚙️</p>
                <p style={{ color: "#0c1a2e", fontWeight: 600, fontSize: 15, marginBottom: 8 }}>
                  Analisando arquivo {scanProgress} de {selectedFiles.length}…
                </p>
                <div style={{ width: "100%", maxWidth: 400, margin: "0 auto 8px", background: "#e5e7eb", borderRadius: 20, height: 8, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 20, background: "#c4a030",
                    width: `${Math.round((scanProgress / selectedFiles.length) * 100)}%`,
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af" }}>
                  {Math.round((scanProgress / selectedFiles.length) * 100)}% — a IA está lendo e extraindo as informações
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 32, marginBottom: 8 }}>📂</p>
                <p style={{ color: "#0c1a2e", fontWeight: 600, fontSize: 15 }}>Arraste arquivos aqui ou clique para selecionar</p>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Vários arquivos de uma vez — PDF, Excel, XML, OFX, imagens</p>
              </>
            )}
          </div>

          {scanErroGeral && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 13, color: "#b91c1c" }}>
              ✗ {scanErroGeral}
            </div>
          )}

          {selectedFiles.length > 0 && step === "selecao" && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, maxHeight: 200, overflowY: "auto" }}>
                {selectedFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", padding: "4px 8px", background: "#f9fafb", borderRadius: 6 }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setSelectedFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={handleScan}
                style={{ padding: "10px 28px", background: "#0c1a2e", color: "#c4a030", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Analisar {selectedFiles.length} arquivo{selectedFiles.length !== 1 ? "s" : ""} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 2: Revisão ── */}
      {step === "pre_classif" && (
        <div>
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>
            A IA analisou os arquivos. <strong>Decida o destino</strong> dos itens abaixo — após confirmar, o sistema salva e exibe o resultado.
          </p>

          {(gruposDecisao.length > 0 || naoReconhecidos.length > 0) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#c2410c", marginBottom: 6 }}>
                ⚠ Requer sua decisão ({totalDecisao})
              </h3>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                Selecione uma ação para cada item. As ações serão executadas ao clicar em <strong>Confirmar e salvar</strong>.
              </p>

              {gruposDecisao.map((grupo) => (
                <DecisaoCard
                  key={grupo.key}
                  grupo={grupo}
                  acaoSelecionada={acoes[grupo.key] ?? null}
                  onAcao={(a) => setAcoes((prev) => ({ ...prev, [grupo.key]: a }))}
                />
              ))}

              {naoReconhecidos.map((arq) => (
                <DecisaoCard
                  key={arq.id}
                  grupo={{
                    key: arq.id, label: arq.nome_arquivo, tipo: arq.tipo,
                    banco: arq.banco, conta: arq.conta, documentos: [arq],
                    razao: "nao_reconhecido", empresaSugeridaNome: null,
                    cnpjExtraido: arq.cnpj_extraido,
                  }}
                  acaoSelecionada={acoes[arq.id] ?? null}
                  onAcao={(a) => setAcoes((prev) => ({ ...prev, [arq.id]: a }))}
                />
              ))}
            </div>
          )}

          {gruposConfirmados.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#16a34a", marginBottom: 10 }}>
                ✓ Contas conhecidas desta empresa — salvos automaticamente ({gruposConfirmados.reduce((s, g) => s + g.documentos.length, 0)} arq.)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {gruposConfirmados.map((grupo) => (
                  <div key={grupo.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, fontSize: 13 }}>
                    <span style={{ color: "#16a34a", fontWeight: 600, flexShrink: 0 }}>✓</span>
                    <span style={{ flex: 1 }}>{grupo.label}</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{grupo.documentos.length} arq.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {comErro.length > 0 && (
            <div style={{ marginBottom: 20, padding: "12px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c", marginBottom: 6 }}>✗ Falha ao processar:</p>
              {comErro.map((arq, i) => <p key={i} style={{ fontSize: 12, color: "#7f1d1d" }}>{arq.nome_arquivo}: {arq.erro}</p>)}
            </div>
          )}

          {gruposConfirmados.length === 0 && gruposDecisao.length === 0 && naoReconhecidos.length === 0 && (
            <div style={{ padding: 16, background: "#f0fdf4", borderRadius: 8, fontSize: 13, color: "#16a34a" }}>
              Nenhum arquivo processado com sucesso.
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              onClick={handleConfirmar}
              disabled={!podeContinuar || (gruposConfirmados.length === 0 && gruposDecisao.length === 0 && naoReconhecidos.length === 0)}
              title={!podeContinuar ? "Escolha uma ação para todos os itens em vermelho" : undefined}
              style={{ padding: "10px 28px", background: podeContinuar ? "#c4a030" : "#e5e7eb", color: podeContinuar ? "#0c1a2e" : "#9ca3af", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: podeContinuar ? "pointer" : "not-allowed" }}
            >
              {totalDecisao > 0 && totalComAcao < totalDecisao
                ? `Escolha as ações (${totalComAcao}/${totalDecisao})`
                : "Confirmar e salvar →"}
            </button>
            <button onClick={resetar}
              style={{ padding: "10px 18px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
              ← Voltar
            </button>
          </div>
        </div>
      )}

      {step === "confirm_loading" && (
        <div style={{ textAlign: "center", padding: 56 }}>
          <p style={{ fontSize: 36 }}>⚙️</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginTop: 12 }}>Verificando duplicatas e salvando…</p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>Aguarde.</p>
        </div>
      )}

      {/* ── Etapa 3: Resultados ── */}
      {step === "resultados" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { key: "classificado",          icon: "✓",  label: "classificado", color: "#16a34a" },
                { key: "duplicata",             icon: "⚠",  label: "duplicata",    color: "#c2410c" },
                { key: "aguardando_roteamento", icon: "📋", label: "na fila",       color: "#7c3aed" },
                { key: "baixado",               icon: "⬇", label: "baixado",       color: "#6b7280" },
              ].map(({ key, icon, label, color }) => {
                const n = finalResults.filter((r) => r.status === key).length;
                return n > 0 ? (
                  <span key={key} style={{ fontSize: 13, color, fontWeight: 600 }}>
                    {icon} {n} {label}{n !== 1 ? "s" : ""}
                  </span>
                ) : null;
              })}
            </div>
            <button onClick={resetar}
              style={{ padding: "7px 16px", background: "#0c1a2e", color: "#c4a030", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              + Enviar mais
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {finalResults.map((resultado) => (
              <ResultadoRow
                key={resultado.id}
                resultado={resultado}
                onPreview={handlePreview}
                previewLoading={previewLoading}
              />
            ))}
          </div>
        </div>
      )}

      {previewState && (
        <PreviewModal url={previewState.url} nome={previewState.nome} onClose={() => setPreviewState(null)} />
      )}
    </div>
  );
}

// ── Card de decisão ────────────────────────────────────────────────────────

function DecisaoCard({ grupo, acaoSelecionada, onAcao }: {
  grupo: GrupoContas;
  acaoSelecionada: Acao | null;
  onAcao: (a: Acao) => void;
}) {
  const razaoInfo: Record<RazaoDecisao, { texto: string; cor: string }> = {
    empresa_errada: {
      texto: grupo.empresaSugeridaNome ? `Parece ser de: ${grupo.empresaSugeridaNome}` : "Conta de outra empresa",
      cor: "#c2410c",
    },
    conta_nova: {
      texto: "Nova conta detectada — confirme se pertence a esta empresa",
      cor: "#7c3aed",
    },
    incompleto: {
      texto: "A IA não identificou o número da conta — verifique o arquivo",
      cor: "#d97706",
    },
    nao_reconhecido: {
      texto: "A IA não conseguiu identificar este arquivo",
      cor: "#d97706",
    },
  };

  const { texto, cor } = razaoInfo[grupo.razao];
  const opcoes: { key: Acao; label: string; desc: string; cor: string; bg: string }[] = [
    { key: "salvar_aqui", label: "Salvar aqui",    desc: "Aceita na empresa atual",               cor: "#15803d", bg: "#f0fdf4" },
    { key: "fila_espera", label: "Fila de espera", desc: "Aguarda ser puxado pela empresa certa", cor: "#7c3aed", bg: "#faf5ff" },
    { key: "baixar",      label: "Baixar arquivo", desc: "Faz download e descarta do sistema",    cor: "#6b7280", bg: "#f9fafb" },
  ];

  return (
    <div style={{ padding: "12px 14px", background: "#fff7ed", border: `1px solid ${acaoSelecionada ? "#d1d5db" : "#fed7aa"}`, borderRadius: 8, marginBottom: 8 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{grupo.label}</span>
          {grupo.documentos.length > 1 && <span style={{ fontSize: 11, color: "#9ca3af" }}>{grupo.documentos.length} arquivos</span>}
        </div>
        <p style={{ fontSize: 12, color: cor, marginTop: 3 }}>{texto}</p>
        {grupo.cnpjExtraido && (
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            CNPJ lido no documento: <strong>{_formatCnpj(grupo.cnpjExtraido)}</strong>
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {opcoes.map((op) => {
          const ativo = acaoSelecionada === op.key;
          return (
            <button
              key={op.key}
              onClick={() => onAcao(op.key)}
              title={op.desc}
              style={{
                padding: "6px 14px",
                background: ativo ? op.bg : "white",
                color: ativo ? op.cor : "#374151",
                border: `1px solid ${ativo ? op.cor : "#d1d5db"}`,
                borderRadius: 6, fontSize: 12, fontWeight: ativo ? 700 : 400,
                cursor: "pointer", transition: "all 0.1s",
              }}
            >
              {ativo ? "✓ " : ""}{op.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Indicador de etapas ────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const etapas = [
    { keys: ["selecao", "scan_loading"],        label: "1 · Selecionar" },
    { keys: ["pre_classif", "confirm_loading"],  label: "2 · Rotear" },
    { keys: ["resultados"],                      label: "3 · Resultado" },
  ];
  const stepIdx = etapas.findIndex((e) => e.keys.includes(step));

  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 28, alignItems: "center" }}>
      {etapas.map((e, i) => {
        const done = i < stepIdx;
        const active = i === stepIdx;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <span style={{
              fontSize: 12, fontWeight: active ? 700 : 500,
              color: active ? "#c4a030" : done ? "#16a34a" : "#9ca3af",
              padding: "4px 10px", borderRadius: 20,
              background: active ? "rgba(196,160,48,0.12)" : "transparent",
            }}>
              {done ? "✓ " : ""}{e.label}
            </span>
            {i < etapas.length - 1 && <span style={{ color: "#d1d5db", margin: "0 4px", fontSize: 12 }}>→</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Linha de resultado ─────────────────────────────────────────────────────

function ResultadoRow({ resultado, onPreview, previewLoading }: {
  resultado: ResultadoFinal;
  onPreview: (docId: string) => void;
  previewLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const { status } = resultado;
  const cfg = ({
    classificado:          { icon: "✓",  color: "#16a34a", bg: "#f0fdf4",  label: "Classificado" },
    duplicata:             { icon: "⚠",  color: "#c2410c", bg: "#fff7ed",  label: "Duplicata" },
    nao_reconhecido:       { icon: "?",  color: "#d97706", bg: "#fefce8",  label: "Não identificado" },
    aguardando_roteamento: { icon: "📋", color: "#7c3aed", bg: "#faf5ff",  label: "Fila de espera" },
    baixado:               { icon: "⬇", color: "#6b7280", bg: "#f9fafb",  label: "Baixado" },
    erro:                  { icon: "✗",  color: "#b91c1c", bg: "#fef2f2",  label: "Erro" },
  } as Record<string, { icon: string; color: string; bg: string; label: string }>)[status]
    ?? { icon: "·", color: "#6b7280", bg: "#f9fafb", label: status };

  const podeVer = ["classificado", "duplicata", "nao_reconhecido", "aguardando_roteamento"].includes(status);
  const isBaixado = status === "baixado" && resultado.download_url;
  const isLoadingThis = previewLoading === resultado.id;
  const isLoadingOriginal = resultado.duplicata_de ? previewLoading === resultado.duplicata_de : false;

  return (
    <div style={{ background: cfg.bg, border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px" }}>
      {/* Linha principal */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {resultado.nome_arquivo}
          </span>
          {/* Info do conflito visível sem expandir */}
          {status === "duplicata" && resultado.duplicata_nome_arquivo && (
            <span style={{ fontSize: 11, color: "#c2410c", display: "block", marginTop: 1 }}>
              Conflita com: <strong>{resultado.duplicata_nome_arquivo}</strong>
            </span>
          )}
          {status === "nao_reconhecido" && (
            <span style={{ fontSize: 11, color: "#d97706" }}>Enviado para fila de revisão</span>
          )}
          {status === "aguardando_roteamento" && (
            <span style={{ fontSize: 11, color: "#7c3aed" }}>Na fila de roteamento</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600, flexShrink: 0 }}>{cfg.label}</span>

        {isBaixado && (
          <a href={resultado.download_url!} target="_blank" rel="noopener noreferrer"
            style={{ padding: "3px 10px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 11, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
            ⬇ Baixar
          </a>
        )}

        {podeVer && (
          <button onClick={() => onPreview(resultado.id)} disabled={isLoadingThis}
            style={{ padding: "3px 10px", background: "white", color: "#2563eb", border: "1px solid #2563eb", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: isLoadingThis ? "not-allowed" : "pointer", opacity: isLoadingThis ? 0.6 : 1, flexShrink: 0 }}>
            {isLoadingThis ? "…" : "👁 Ver"}
          </button>
        )}

        {status === "duplicata" && resultado.duplicata_de && (
          <button onClick={() => onPreview(resultado.duplicata_de!)} disabled={isLoadingOriginal}
            title="Visualizar o arquivo que já estava salvo"
            style={{ padding: "3px 10px", background: "white", color: "#c2410c", border: "1px solid #c2410c", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: isLoadingOriginal ? "not-allowed" : "pointer", opacity: isLoadingOriginal ? 0.6 : 1, flexShrink: 0 }}>
            {isLoadingOriginal ? "…" : "👁 Original"}
          </button>
        )}

        <button onClick={() => setExpanded((v) => !v)}
          style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 8px", cursor: "pointer", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {/* Detalhes expandidos — apenas informacionais */}
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px" }}>
            {resultado.tipo && <Detail label="Tipo" value={TIPO_LABEL[resultado.tipo] ?? resultado.tipo} />}
            {resultado.banco && <Detail label="Banco" value={resultado.banco} />}
            {resultado.conta && <Detail label="Conta" value={resultado.conta} />}
            {resultado.mes_referencia && <Detail label="Mês" value={_mesPtBR(resultado.mes_referencia)} />}
            {resultado.nome_sugerido && <Detail label="Nome sugerido" value={resultado.nome_sugerido} highlight />}
            {status === "duplicata" && resultado.duplicata_nome_arquivo && (
              <Detail label="Conflita com" value={resultado.duplicata_nome_arquivo} />
            )}
          </div>
          {(status === "duplicata" || status === "nao_reconhecido") && (
            <p style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>
              Para resolver este item, acesse a <strong>Fila de revisão</strong> na página da empresa.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal de preview ──────────────────────────────────────────────────────

function PreviewModal({ url, nome, onClose }: { url: string; nome: string; onClose: () => void }) {
  const ext = nome.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "webp", "tiff", "bmp", "gif"].includes(ext);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", flexDirection: "column" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "rgba(0,0,0,0.5)", flexShrink: 0 }}>
        <span style={{ color: "white", fontSize: 13, fontWeight: 500, maxWidth: "calc(100% - 120px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ padding: "5px 14px", background: "rgba(196,160,48,0.2)", color: "#c4a030", border: "1px solid #c4a030", borderRadius: 6, fontSize: 12, textDecoration: "none" }}>
            Abrir em nova aba
          </a>
          <button onClick={onClose} style={{ padding: "5px 14px", background: "white", color: "#0c1a2e", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕ Fechar</button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
        {isImage
          ? <img src={url} alt={nome} style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 6, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }} />
          : <iframe src={url} title={nome} style={{ width: "100%", maxWidth: 900, height: "85vh", border: "none", borderRadius: 6, background: "white" }} />
        }
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────


function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ fontSize: 12 }}>
      <span style={{ color: "#9ca3af" }}>{label}: </span>
      <span style={{ fontWeight: highlight ? 700 : 400, color: highlight ? "#15803d" : "#374151" }}>{value}</span>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#6b7280", marginBottom: 3, fontWeight: 500 };
const inp: React.CSSProperties = { width: "100%", padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 12, background: "white", boxSizing: "border-box" };

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

function _formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
