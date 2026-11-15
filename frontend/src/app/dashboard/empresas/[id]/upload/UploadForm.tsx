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
  erro?: string;
};

type GrupoContas = {
  key: string;
  label: string;
  tipo: string | null;
  banco: string | null;
  conta: string | null;
  documentos: ScanArquivo[];
  ehOutraEmpresa: boolean;
  empresaSugeridaNome: string | null;
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

  // Grupos classificados por conta
  const [gruposConfirmados, setGruposConfirmados] = useState<GrupoContas[]>([]);
  const [gruposDecisao, setGruposDecisao] = useState<GrupoContas[]>([]);
  const [naoReconhecidos, setNaoReconhecidos] = useState<ScanArquivo[]>([]);
  const [comErro, setComErro] = useState<ScanArquivo[]>([]);

  // Ações escolhidas pelo usuário: chave = grupoKey ou docId
  const [acoes, setAcoes] = useState<Record<string, Acao>>({});

  const [finalResults, setFinalResults] = useState<ResultadoFinal[]>([]);
  const [previewState, setPreviewState] = useState<{ url: string; nome: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [acoesFinal, setAcoesFinal] = useState<Record<string, string | null>>({});
  const [scanErroGeral, setScanErroGeral] = useState<string | null>(null);

  function addFiles(files: FileList | File[]) {
    setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
  }

  async function handleScan() {
    if (!selectedFiles.length) return;
    setStep("scan_loading");
    setScanErroGeral(null);

    const form = new FormData();
    form.append("empresa_id", empresaId);
    for (const f of selectedFiles) form.append("files", f);

    try {
      const res = await fetch(`${API}/upload/scan`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erro ao processar arquivos");
      }
      const data = await res.json();
      const arquivos: ScanArquivo[] = data.arquivos || [];

      const erros: ScanArquivo[] = [];
      const naoRec: ScanArquivo[] = [];
      const confirmadosMap = new Map<string, GrupoContas>();
      const decisaoMap = new Map<string, GrupoContas>();

      for (const arq of arquivos) {
        if (arq.status === "erro" || arq.erro) { erros.push(arq); continue; }

        if (arq.status === "nao_reconhecido") { naoRec.push(arq); continue; }

        const contaNorm = (arq.conta || "").toLowerCase().replace(/[^\d]/g, "");
        const bancoNorm = (arq.banco || "").toLowerCase().trim();
        const key = bancoNorm && contaNorm
          ? `${bancoNorm}|${contaNorm}`
          : `cnpj_${(arq.cnpj_extraido || "").replace(/\D/g, "") || arq.id}`;

        const ehOutra = !!arq.empresa_sugerida_id && arq.empresa_sugerida_id !== empresaId;
        const targetMap = ehOutra ? decisaoMap : confirmadosMap;

        if (!targetMap.has(key)) {
          const tLabel = TIPO_LABEL[arq.tipo ?? ""] ?? "Documento";
          const label = arq.banco && arq.conta
            ? `${tLabel} — ${arq.banco} CC ${arq.conta}`
            : tLabel;
          targetMap.set(key, {
            key, label,
            tipo: arq.tipo, banco: arq.banco, conta: arq.conta,
            documentos: [],
            ehOutraEmpresa: ehOutra,
            empresaSugeridaNome: arq.empresa_sugerida_nome ?? null,
          });
        }
        targetMap.get(key)!.documentos.push(arq);
      }

      setGruposConfirmados(Array.from(confirmadosMap.values()));
      setGruposDecisao(Array.from(decisaoMap.values()));
      setNaoReconhecidos(naoRec);
      setComErro(erros);
      setAcoes({});
      setStep("pre_classif");
    } catch (e: any) {
      setScanErroGeral(e.message || "Erro desconhecido");
      setStep("selecao");
    }
  }

  // Verifica se todos os itens que precisam de decisão têm uma ação definida
  const totalDecisao = gruposDecisao.length + naoReconhecidos.length;
  const totalComAcao = Object.keys(acoes).length;
  const podeContinuar = totalDecisao === 0 || totalComAcao >= totalDecisao;

  async function handleConfirmar() {
    setStep("confirm_loading");

    const mapeamentos: { documento_id: string; acao: Acao }[] = [];

    // Confirmados: salvar aqui automaticamente
    for (const grupo of gruposConfirmados) {
      for (const doc of grupo.documentos) {
        mapeamentos.push({ documento_id: doc.id, acao: "salvar_aqui" });
      }
    }
    // Grupos de decisão
    for (const grupo of gruposDecisao) {
      const acao = acoes[grupo.key] ?? "salvar_aqui";
      for (const doc of grupo.documentos) {
        mapeamentos.push({ documento_id: doc.id, acao });
      }
    }
    // Não reconhecidos
    for (const doc of naoReconhecidos) {
      const acao = acoes[doc.id] ?? "salvar_aqui";
      mapeamentos.push({ documento_id: doc.id, acao });
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
    setAcoesFinal({});
    setScanErroGeral(null);
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
      {/* Cabeçalho */}
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
            style={{ border: "2px dashed #c4a030", borderRadius: 10, padding: "28px 20px", textAlign: "center", cursor: step === "selecao" ? "pointer" : "default", background: "#faf8f4", opacity: step === "scan_loading" ? 0.5 : 1 }}
          >
            <input ref={inputRef} type="file" multiple style={{ display: "none" }}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.bmp,.xml,.ofx,.ofc,.xlsx,.xls,.csv"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />
            <p style={{ fontSize: 32, marginBottom: 8 }}>{step === "scan_loading" ? "⚙️" : "📂"}</p>
            {step === "scan_loading" ? (
              <>
                <p style={{ color: "#0c1a2e", fontWeight: 600, fontSize: 15 }}>Analisando {selectedFiles.length} arquivo{selectedFiles.length !== 1 ? "s" : ""}…</p>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>A IA está lendo e extraindo as informações.</p>
              </>
            ) : (
              <>
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

      {/* ── Etapa 2: Revisão rápida ── */}
      {step === "pre_classif" && (
        <div>
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>
            A IA analisou os arquivos. Revise os itens que precisam de decisão antes de salvar.
          </p>

          {/* Itens que precisam de decisão */}
          {(gruposDecisao.length > 0 || naoReconhecidos.length > 0) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#c2410c", marginBottom: 10 }}>
                ⚠ Requer sua decisão ({totalDecisao})
              </h3>

              {/* Grupos de outra empresa */}
              {gruposDecisao.map((grupo) => (
                <DecisaoCard
                  key={grupo.key}
                  titulo={grupo.label}
                  subtitulo={grupo.empresaSugeridaNome ? `Parece ser de: ${grupo.empresaSugeridaNome}` : "Conta de outra empresa"}
                  corSubtitulo="#c2410c"
                  numArquivos={grupo.documentos.length}
                  acaoSelecionada={acoes[grupo.key] ?? null}
                  onAcao={(a) => setAcoes((prev) => ({ ...prev, [grupo.key]: a }))}
                />
              ))}

              {/* Não reconhecidos */}
              {naoReconhecidos.map((arq) => (
                <DecisaoCard
                  key={arq.id}
                  titulo={arq.nome_arquivo}
                  subtitulo="A IA não conseguiu identificar este arquivo"
                  corSubtitulo="#d97706"
                  numArquivos={1}
                  acaoSelecionada={acoes[arq.id] ?? null}
                  onAcao={(a) => setAcoes((prev) => ({ ...prev, [arq.id]: a }))}
                />
              ))}
            </div>
          )}

          {/* Confirmados automaticamente */}
          {gruposConfirmados.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#16a34a", marginBottom: 10 }}>
                ✓ Desta empresa — serão salvos automaticamente ({gruposConfirmados.reduce((s, g) => s + g.documentos.length, 0)} arquivo{gruposConfirmados.reduce((s, g) => s + g.documentos.length, 0) !== 1 ? "s" : ""})
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

          {/* Erros de leitura */}
          {comErro.length > 0 && (
            <div style={{ marginBottom: 20, padding: "12px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c", marginBottom: 6 }}>✗ Falha ao processar:</p>
              {comErro.map((arq, i) => <p key={i} style={{ fontSize: 12, color: "#7f1d1d" }}>{arq.nome_arquivo}: {arq.erro}</p>)}
            </div>
          )}

          {gruposConfirmados.length === 0 && gruposDecisao.length === 0 && naoReconhecidos.length === 0 && (
            <div style={{ padding: 16, background: "#f0fdf4", borderRadius: 8, fontSize: 13, color: "#16a34a" }}>
              Nenhum arquivo processado. Verifique os arquivos e tente novamente.
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

      {/* ── Carregando confirmação ── */}
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
            <div>
              {finalResults.filter((r) => r.status === "classificado").length > 0 && (
                <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600, marginRight: 12 }}>
                  ✓ {finalResults.filter((r) => r.status === "classificado").length} classificado{finalResults.filter((r) => r.status === "classificado").length !== 1 ? "s" : ""}
                </span>
              )}
              {finalResults.filter((r) => r.status === "duplicata").length > 0 && (
                <span style={{ fontSize: 13, color: "#c2410c", fontWeight: 600, marginRight: 12 }}>
                  ⚠ {finalResults.filter((r) => r.status === "duplicata").length} duplicata{finalResults.filter((r) => r.status === "duplicata").length !== 1 ? "s" : ""}
                </span>
              )}
              {finalResults.filter((r) => r.status === "aguardando_roteamento").length > 0 && (
                <span style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600, marginRight: 12 }}>
                  📋 {finalResults.filter((r) => r.status === "aguardando_roteamento").length} na fila
                </span>
              )}
              {finalResults.filter((r) => r.status === "baixado").length > 0 && (
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
                  ⬇ {finalResults.filter((r) => r.status === "baixado").length} baixado{finalResults.filter((r) => r.status === "baixado").length !== 1 ? "s" : ""}
                </span>
              )}
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
                empresaId={empresaId}
                acaoFinalizada={acoesFinal[resultado.id] ?? null}
                onAcaoFinalizada={(msg) => setAcoesFinal((prev) => ({ ...prev, [resultado.id]: msg }))}
                onPreview={() => handlePreview(resultado.id)}
                previewLoading={previewLoading === resultado.id}
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

// ── Card de decisão (3 botões) ─────────────────────────────────────────────

function DecisaoCard({ titulo, subtitulo, corSubtitulo, numArquivos, acaoSelecionada, onAcao }: {
  titulo: string;
  subtitulo: string;
  corSubtitulo: string;
  numArquivos: number;
  acaoSelecionada: Acao | null;
  onAcao: (a: Acao) => void;
}) {
  const opcoes: { key: Acao; label: string; desc: string; cor: string; bg: string }[] = [
    { key: "salvar_aqui", label: "Salvar aqui",   desc: "Aceita na empresa atual",           cor: "#15803d", bg: "#f0fdf4" },
    { key: "fila_espera", label: "Fila de espera", desc: "Aguarda ser puxado pela empresa certa", cor: "#7c3aed", bg: "#faf5ff" },
    { key: "baixar",      label: "Baixar arquivo", desc: "Faz download e descarta do sistema",   cor: "#6b7280", bg: "#f9fafb" },
  ];

  return (
    <div style={{ padding: "12px 14px", background: "#fff7ed", border: `1px solid ${acaoSelecionada ? "#d1d5db" : "#fed7aa"}`, borderRadius: 8, marginBottom: 8 }}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{titulo}</span>
        {numArquivos > 1 && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>{numArquivos} arquivos</span>}
        <p style={{ fontSize: 12, color: corSubtitulo, marginTop: 2 }}>{subtitulo}</p>
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
                borderRadius: 6,
                fontSize: 12,
                fontWeight: ativo ? 700 : 400,
                cursor: "pointer",
                transition: "all 0.1s",
              }}
            >
              {op.label}
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
    { keys: ["selecao", "scan_loading"],     label: "1 · Selecionar" },
    { keys: ["pre_classif", "confirm_loading"], label: "2 · Revisar" },
    { keys: ["resultados"],                  label: "3 · Resultado" },
  ];
  const stepIdx = etapas.findIndex((e) => e.keys.includes(step));

  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 28, alignItems: "center" }}>
      {etapas.map((e, i) => {
        const done = i < stepIdx;
        const active = i === stepIdx;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "#c4a030" : done ? "#16a34a" : "#9ca3af", padding: "4px 10px", borderRadius: 20, background: active ? "rgba(196,160,48,0.12)" : "transparent" }}>
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

function ResultadoRow({ resultado, empresaId, acaoFinalizada, onAcaoFinalizada, onPreview, previewLoading }: {
  resultado: ResultadoFinal;
  empresaId: string;
  acaoFinalizada: string | null;
  onAcaoFinalizada: (msg: string) => void;
  onPreview: () => void;
  previewLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null);
  const [classificandoManual, setClassificandoManual] = useState(false);
  const [manualForm, setManualForm] = useState({ tipo: "extrato_bancario", mes_referencia: "", banco: "", conta: "" });

  const { status } = resultado;
  const cfg = {
    classificado:          { icon: "✓", color: "#16a34a", bg: "#f0fdf4",  label: "Classificado" },
    duplicata:             { icon: "⚠", color: "#c2410c", bg: "#fff7ed",  label: "Duplicata" },
    nao_reconhecido:       { icon: "?", color: "#d97706", bg: "#fefce8",  label: "Não identificado" },
    aguardando_roteamento: { icon: "📋", color: "#7c3aed", bg: "#faf5ff", label: "Fila de espera" },
    baixado:               { icon: "⬇", color: "#6b7280", bg: "#f9fafb",  label: "Baixado" },
    erro:                  { icon: "✗", color: "#b91c1c", bg: "#fef2f2",  label: "Erro" },
  }[status] ?? { icon: "·", color: "#6b7280", bg: "#f9fafb", label: status };

  async function logAcao(tipo_acao: string, detalhes?: object) {
    try {
      await fetch(`${API}/acoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, documento_id: resultado.id, tipo_acao, detalhes }),
      });
    } catch {}
  }

  async function handleSubstituir() {
    if (!resultado.duplicata_de) return;
    setAcaoEmAndamento("substituir");
    try {
      const r = await fetch(`${API}/documentos/${resultado.id}/substituir/${resultado.duplicata_de}`, { method: "POST" });
      if (r.ok) { await logAcao("substituir_duplicata", { original_id: resultado.duplicata_de }); onAcaoFinalizada("Original substituído — documento classificado"); }
      else alert("Erro ao substituir.");
    } finally { setAcaoEmAndamento(null); }
  }

  async function handleExcluir() {
    setAcaoEmAndamento("excluir");
    try {
      const r = await fetch(`${API}/documentos/${resultado.id}`, { method: "DELETE" });
      if (r.ok) { await logAcao("excluir_duplicata"); onAcaoFinalizada("Arquivo excluído"); }
      else alert("Erro ao excluir.");
    } finally { setAcaoEmAndamento(null); }
  }

  async function handleClassificarManual() {
    if (!manualForm.tipo || !manualForm.mes_referencia) { alert("Preencha tipo e mês (YYYY-MM)."); return; }
    setAcaoEmAndamento("classificar");
    try {
      const r = await fetch(`${API}/documentos/${resultado.id}/classificar-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...manualForm, banco: manualForm.banco || null, conta: manualForm.conta || null }),
      });
      if (r.ok) { await logAcao("classificar_manual", manualForm); onAcaoFinalizada("Classificado manualmente"); setClassificandoManual(false); }
      else alert("Erro ao classificar.");
    } finally { setAcaoEmAndamento(null); }
  }

  const temAcao = ["duplicata", "nao_reconhecido"].includes(status);
  const isBaixado = status === "baixado" && resultado.download_url;

  return (
    <div style={{ background: cfg.bg, border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {resultado.nome_arquivo}
        </span>
        <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600, flexShrink: 0 }}>{cfg.label}</span>

        {isBaixado && (
          <a href={resultado.download_url!} target="_blank" rel="noopener noreferrer"
            style={{ padding: "3px 10px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 11, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
            ⬇ Baixar
          </a>
        )}

        {temAcao && !acaoFinalizada && (
          <button onClick={onPreview} disabled={previewLoading}
            style={{ padding: "3px 10px", background: "white", color: "#2563eb", border: "1px solid #2563eb", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: previewLoading ? "not-allowed" : "pointer", opacity: previewLoading ? 0.6 : 1, flexShrink: 0 }}>
            {previewLoading ? "..." : "👁 Ver"}
          </button>
        )}

        <button onClick={() => setExpanded((v) => !v)}
          style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 8px", cursor: "pointer", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", marginBottom: 10 }}>
            {resultado.tipo && <Detail label="Tipo" value={TIPO_LABEL[resultado.tipo] ?? resultado.tipo} />}
            {resultado.banco && <Detail label="Banco" value={resultado.banco} />}
            {resultado.conta && <Detail label="Conta" value={resultado.conta} />}
            {resultado.mes_referencia && <Detail label="Mês" value={_mesPtBR(resultado.mes_referencia)} />}
            {resultado.nome_sugerido && <Detail label="Nome sugerido" value={resultado.nome_sugerido} highlight />}
          </div>

          {acaoFinalizada ? (
            <div style={{ padding: "6px 10px", background: "#f0fdf4", borderRadius: 6, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ {acaoFinalizada}</div>
          ) : (
            <>
              {status === "duplicata" && resultado.duplicata_de && (
                <div style={{ display: "flex", gap: 8 }}>
                  <AcaoBtn onClick={handleSubstituir} loading={acaoEmAndamento === "substituir"} label="↩ Substituir original" color="#16a34a" />
                  <AcaoBtn onClick={handleExcluir} loading={acaoEmAndamento === "excluir"} label="✕ Excluir este" color="#b91c1c" />
                </div>
              )}
              {status === "nao_reconhecido" && (
                <div>
                  {!classificandoManual
                    ? <AcaoBtn onClick={() => setClassificandoManual(true)} loading={false} label="✏ Classificar agora" color="#d97706" />
                    : <ClassificacaoForm form={manualForm} onChange={setManualForm} onSubmit={handleClassificarManual} onCancel={() => setClassificandoManual(false)} loading={acaoEmAndamento === "classificar"} />
                  }
                </div>
              )}
            </>
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

function AcaoBtn({ onClick, loading, label, color }: { onClick: () => void; loading: boolean; label: string; color: string }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding: "5px 12px", background: "white", color, border: `1px solid ${color}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
      {loading ? "Aguarde..." : label}
    </button>
  );
}

function ClassificacaoForm({ form, onChange, onSubmit, onCancel, loading }: {
  form: { tipo: string; mes_referencia: string; banco: string; conta: string };
  onChange: (f: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div style={{ marginTop: 8, padding: 12, background: "#faf8f4", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={lbl}>Tipo</label>
          <select value={form.tipo} onChange={(e) => onChange({ ...form, tipo: e.target.value })} style={inp}>
            {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Mês (YYYY-MM)</label>
          <input placeholder="Ex: 2025-01" value={form.mes_referencia} onChange={(e) => onChange({ ...form, mes_referencia: e.target.value })} style={inp} />
        </div>
        {form.tipo === "extrato_bancario" && (
          <>
            <div><label style={lbl}>Banco</label><input placeholder="Ex: Itaú" value={form.banco} onChange={(e) => onChange({ ...form, banco: e.target.value })} style={inp} /></div>
            <div><label style={lbl}>Conta</label><input placeholder="Ex: 12345-6" value={form.conta} onChange={(e) => onChange({ ...form, conta: e.target.value })} style={inp} /></div>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSubmit} disabled={loading} style={{ padding: "6px 14px", background: "#0c1a2e", color: "#c4a030", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={onCancel} style={{ padding: "6px 12px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
      </div>
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

const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#6b7280", marginBottom: 3, fontWeight: 500 };
const inp: React.CSSProperties = { width: "100%", padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 12, background: "white", boxSizing: "border-box" };

const _MESES: Record<string, string> = { "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril", "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto", "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro" };
function _mesPtBR(mes: string) {
  if (mes.length !== 7) return mes;
  const [ano, m] = mes.split("-");
  return `${_MESES[m] ?? m}/${ano}`;
}
