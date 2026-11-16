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

// ── Tipos ──────────────────────────────────────────────────────────────────

type Step =
  | "selecao"
  | "scan_loading"
  | "contas_identificacao"
  | "arquivos_revisao"
  | "confirm_loading"
  | "resultado";

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

type ContaCard = {
  key: string;
  cnpj: string | null;
  empresaNome: string | null;
  empresaSugeridaId: string | null; // id da empresa detectada pelo CNPJ (diferente da atual)
  banco: string | null;
  conta: string | null;
  arquivos: ScanArquivo[];
  pertence: boolean;
  moverDireto: boolean; // enviar diretamente para a empresa sugerida
  oculta: boolean;
};

type GrupoFormatos = {
  key: string;
  tipo: string;
  banco: string | null;
  conta: string | null;
  mesRef: string | null;
  arquivos: ScanArquivo[];
  manter: string[]; // ids dos arquivos que o usuário quer manter
};

type ArquivoSemTipo = {
  arquivo: ScanArquivo;
  tipoSelecionado: string | null;
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
  const [scanErroGeral, setScanErroGeral] = useState<string | null>(null);
  const [erros, setErros] = useState<ScanArquivo[]>([]);

  // Etapa 2: contas identificadas
  const [contas, setContas] = useState<ContaCard[]>([]);

  // Etapa 3: arquivos por conta confirmada
  const [gruposFormatos, setGruposFormatos] = useState<GrupoFormatos[]>([]);
  const [arquivosSemTipo, setArquivosSemTipo] = useState<ArquivoSemTipo[]>([]);

  // Resultado
  const [finalResults, setFinalResults] = useState<ResultadoFinal[]>([]);
  const [previewState, setPreviewState] = useState<{ url: string; nome: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  function addFiles(files: FileList | File[]) {
    setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
  }

  // ── Scan ────────────────────────────────────────────────────────────────

  async function handleScan() {
    if (!selectedFiles.length) return;
    setStep("scan_loading");
    setScanProgress(0);
    setScanErroGeral(null);

    const allArquivos: ScanArquivo[] = [];

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

    // Separa erros e monta ContaCards
    const errosList = allArquivos.filter((a) => a.status === "erro" || !!a.erro);
    const validos = allArquivos.filter((a) => a.status !== "erro" && !a.erro);

    setErros(errosList);
    setContas(buildContaCards(validos, empresaId));
    setStep("contas_identificacao");
  }

  // ── Monta ContaCards a partir dos resultados do scan ─────────────────────

  function buildContaCards(arquivos: ScanArquivo[], empId: string): ContaCard[] {
    const map = new Map<string, ContaCard>();
    for (const arq of arquivos) {
      const cnpjNorm = (arq.cnpj_extraido || "").replace(/\D/g, "");
      const bancoNorm = (arq.banco || "").toLowerCase().trim();
      const contaNorm = (arq.conta || "").replace(/[^\d]/g, "");
      const rawKey = `${cnpjNorm}:${bancoNorm}:${contaNorm}`;
      const key = rawKey === "::" ? `unknown_${arq.id}` : rawKey;

      if (!map.has(key)) {
        const pertence = !arq.empresa_sugerida_id || arq.empresa_sugerida_id === empId;
        // empresaSugeridaId só preenchido quando aponta para outra empresa (não a atual)
        const empresaSugeridaId = arq.empresa_sugerida_id && arq.empresa_sugerida_id !== empId
          ? arq.empresa_sugerida_id : null;
        map.set(key, {
          key,
          cnpj: arq.cnpj_extraido,
          empresaNome: arq.empresa_sugerida_nome,
          empresaSugeridaId,
          banco: arq.banco,
          conta: arq.conta,
          arquivos: [],
          pertence,
          moverDireto: false,
          oculta: false,
        });
      }
      map.get(key)!.arquivos.push(arq);
    }
    return Array.from(map.values());
  }

  // ── Avança para revisão de arquivos ──────────────────────────────────────

  function goToArquivosRevisao() {
    const pertenceArquivos = contas
      .filter((c) => c.pertence && !c.oculta && !c.moverDireto)
      .flatMap((c) => c.arquivos)
      .filter((a) => !!a.id);

    // Encontra grupos de formatos duplicados (mesmo tipo+banco+conta+mes, 2+ arquivos)
    const formatMap = new Map<string, GrupoFormatos>();
    for (const arq of pertenceArquivos) {
      if (!arq.tipo) continue;
      const bancoNorm = (arq.banco || "").toLowerCase().trim();
      const contaNorm = (arq.conta || "").replace(/[^\d]/g, "");
      const fkey = `${arq.tipo}|${bancoNorm}|${contaNorm}|${arq.mes_referencia || ""}`;
      if (!formatMap.has(fkey)) {
        formatMap.set(fkey, {
          key: fkey, tipo: arq.tipo, banco: arq.banco, conta: arq.conta,
          mesRef: arq.mes_referencia, arquivos: [], manter: [],
        });
      }
      formatMap.get(fkey)!.arquivos.push(arq);
    }
    const grupos = Array.from(formatMap.values()).filter((g) => g.arquivos.length > 1);
    for (const g of grupos) g.manter = g.arquivos.map((a) => a.id); // padrão: manter todos

    const gruposIds = new Set(grupos.flatMap((g) => g.arquivos.map((a) => a.id)));

    // Arquivos sem tipo identificado (pertence, mas AI não classificou)
    const semTipo: ArquivoSemTipo[] = pertenceArquivos
      .filter((a) => !a.tipo && !gruposIds.has(a.id))
      .map((a) => ({ arquivo: a, tipoSelecionado: null }));

    setGruposFormatos(grupos);
    setArquivosSemTipo(semTipo);
    setStep("arquivos_revisao");
  }

  // ── Confirmar e salvar ────────────────────────────────────────────────────

  async function handleConfirmar() {
    setStep("confirm_loading");

    // 1. Classificação manual para arquivos sem tipo que o usuário preencheu
    for (const item of arquivosSemTipo) {
      if (item.tipoSelecionado && item.arquivo.id) {
        try {
          await fetch(`${API}/documentos/${item.arquivo.id}/classificar-manual`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo: item.tipoSelecionado,
              mes_referencia: item.arquivo.mes_referencia,
              banco: item.arquivo.banco,
              conta: item.arquivo.conta,
            }),
          });
        } catch {}
      }
    }

    // 2. Monta mapeamentos
    // 1a. Mover direto para empresa sugerida (antes do confirmar principal)
    const moverDiretoResults: ResultadoFinal[] = [];
    for (const conta of contas.filter((c) => c.moverDireto && c.empresaSugeridaId)) {
      for (const arq of conta.arquivos.filter((a) => !!a.id)) {
        try {
          await fetch(`${API}/documentos/${arq.id}/mover-empresa/${conta.empresaSugeridaId}`, { method: "POST" });
          moverDiretoResults.push({
            id: arq.id, nome_arquivo: arq.nome_arquivo, tipo: arq.tipo,
            banco: arq.banco, conta: arq.conta, mes_referencia: arq.mes_referencia,
            status: "movido_empresa", duplicata_de: null,
            empresa_id: conta.empresaSugeridaId!, cnpj_extraido: arq.cnpj_extraido,
            confidence: arq.confidence, nome_sugerido: `→ ${conta.empresaNome ?? conta.empresaSugeridaId}`,
          });
        } catch {
          moverDiretoResults.push({
            id: arq.id, nome_arquivo: arq.nome_arquivo, tipo: arq.tipo,
            banco: arq.banco, conta: arq.conta, mes_referencia: arq.mes_referencia,
            status: "erro", duplicata_de: null,
            empresa_id: conta.empresaSugeridaId!, cnpj_extraido: arq.cnpj_extraido,
            confidence: arq.confidence,
          });
        }
      }
    }

    const mapeamentos: { documento_id: string; acao: string; is_nova_conta: boolean; allow_format_duplicate: boolean }[] = [];

    const gruposFormatosIds = new Set(gruposFormatos.flatMap((g) => g.arquivos.map((a) => a.id)));
    const semTipoIds = new Set(arquivosSemTipo.map((a) => a.arquivo.id));

    const pertenceArquivos = contas
      .filter((c) => c.pertence && !c.oculta && !c.moverDireto)
      .flatMap((c) => c.arquivos)
      .filter((a) => !!a.id);

    const naoPertenceArquivos = contas
      .filter((c) => (!c.pertence || c.oculta) && !c.moverDireto)
      .flatMap((c) => c.arquivos)
      .filter((a) => !!a.id);

    // Arquivos prontos (tipo conhecido, sem conflito de formato)
    const prontos = pertenceArquivos.filter(
      (a) => a.tipo && !gruposFormatosIds.has(a.id) && !semTipoIds.has(a.id),
    );
    for (const arq of prontos) {
      mapeamentos.push({ documento_id: arq.id, acao: "salvar_aqui", is_nova_conta: arq.conta_nova, allow_format_duplicate: false });
    }

    // Grupos de formato duplicado
    for (const grupo of gruposFormatos) {
      const keepMany = grupo.manter.length > 1;
      for (const arq of grupo.arquivos) {
        if (grupo.manter.includes(arq.id)) {
          mapeamentos.push({ documento_id: arq.id, acao: "salvar_aqui", is_nova_conta: arq.conta_nova, allow_format_duplicate: keepMany });
        } else {
          mapeamentos.push({ documento_id: arq.id, acao: "baixar", is_nova_conta: false, allow_format_duplicate: false });
        }
      }
    }

    // Arquivos sem tipo
    for (const item of arquivosSemTipo) {
      if (!item.arquivo.id) continue;
      // Se usuário classificou → salvar_aqui; senão → fila global
      const acao = item.tipoSelecionado ? "salvar_aqui" : "fila_espera";
      mapeamentos.push({ documento_id: item.arquivo.id, acao, is_nova_conta: false, allow_format_duplicate: false });
    }

    // Arquivos de contas que não pertencem → fila global
    for (const arq of naoPertenceArquivos) {
      mapeamentos.push({ documento_id: arq.id, acao: "fila_espera", is_nova_conta: false, allow_format_duplicate: false });
    }

    try {
      const res = await fetch(`${API}/upload/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, mapeamentos }),
      });
      const data = await res.json();
      setFinalResults([...moverDiretoResults, ...(data.resultados || [])]);
      setStep("resultado");
    } catch {
      alert("Erro ao confirmar. Tente novamente.");
      setStep("arquivos_revisao");
    }
  }

  function resetar() {
    setSelectedFiles([]);
    setErros([]);
    setContas([]);
    setGruposFormatos([]);
    setArquivosSemTipo([]);
    setFinalResults([]);
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/dashboard/empresas/${empresaId}`} style={{ fontSize: 13, color: "#c4a030", textDecoration: "none" }}>
          ← {empresaNome}
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: "#0c1a2e" }}>Enviar documentos</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          Selecione os arquivos — a IA identifica as contas e classifica automaticamente.
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
                  <div style={{ height: "100%", borderRadius: 20, background: "#c4a030", width: `${Math.round((scanProgress / selectedFiles.length) * 100)}%`, transition: "width 0.4s ease" }} />
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

      {/* ── Etapa 2: Contas identificadas ── */}
      {step === "contas_identificacao" && (
        <ContasIdentificacaoStep
          empresaNome={empresaNome}
          contas={contas}
          setContas={setContas}
          erros={erros}
          onNext={goToArquivosRevisao}
          onVoltar={resetar}
        />
      )}

      {/* ── Etapa 3: Revisão de arquivos ── */}
      {step === "arquivos_revisao" && (
        <ArquivosRevisaoStep
          contas={contas}
          gruposFormatos={gruposFormatos}
          setGruposFormatos={setGruposFormatos}
          arquivosSemTipo={arquivosSemTipo}
          setArquivosSemTipo={setArquivosSemTipo}
          onConfirmar={handleConfirmar}
          onVoltar={() => setStep("contas_identificacao")}
        />
      )}

      {step === "confirm_loading" && (
        <div style={{ textAlign: "center", padding: 56 }}>
          <p style={{ fontSize: 36 }}>⚙️</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginTop: 12 }}>Verificando duplicatas e salvando…</p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>Aguarde.</p>
        </div>
      )}

      {/* ── Resultado ── */}
      {step === "resultado" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>Envio concluído. Resultado por arquivo:</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { key: "classificado",          label: "classificado",    bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
                  { key: "movido_empresa",        label: "movido",          bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
                  { key: "duplicata",             label: "duplicata",       bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
                  { key: "aguardando_roteamento", label: "fila global",     bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe" },
                  { key: "nao_reconhecido",       label: "não identificado", bg: "#fefce8", color: "#d97706", border: "#fde68a" },
                  { key: "baixado",               label: "baixado",          bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
                ].map(({ key, label, bg, color, border }) => {
                  const n = finalResults.filter((r) => r.status === key).length;
                  return n > 0 ? (
                    <span key={key} style={{ fontSize: 12, fontWeight: 600, color, background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: "3px 10px" }}>
                      {n} {label}{n !== 1 ? "s" : ""}
                    </span>
                  ) : null;
                })}
              </div>
              {finalResults.some((r) => r.status === "aguardando_roteamento") && (
                <p style={{ fontSize: 12, color: "#7c3aed", marginTop: 8 }}>
                  Arquivos na fila global aguardam destino.{" "}
                  <Link href="/dashboard/fila-global" style={{ color: "#7c3aed", fontWeight: 600 }}>
                    Ir para Aguardando Aprovação →
                  </Link>
                </p>
              )}
            </div>
            <button onClick={resetar}
              style={{ padding: "8px 18px", background: "#0c1a2e", color: "#c4a030", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, marginLeft: 12 }}>
              + Enviar mais
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {finalResults.map((resultado) => (
              <ResultadoRow key={resultado.id} resultado={resultado} onPreview={handlePreview} previewLoading={previewLoading} />
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

// ── Etapa 2: Contas identificadas ──────────────────────────────────────────

function ContasIdentificacaoStep({
  empresaNome, contas, setContas, erros, onNext, onVoltar,
}: {
  empresaNome: string;
  contas: ContaCard[];
  setContas: React.Dispatch<React.SetStateAction<ContaCard[]>>;
  erros: ScanArquivo[];
  onNext: () => void;
  onVoltar: () => void;
}) {
  const visiveis = contas.filter((c) => !c.oculta);
  const ocultas = contas.filter((c) => c.oculta);
  const moverDiretoContas = contas.filter((c) => c.moverDireto);
  const totalArquivos = contas.flatMap((c) => c.arquivos).length;

  function toggle(key: string, pertence: boolean) {
    setContas((prev) => prev.map((c) => (c.key === key ? { ...c, pertence, moverDireto: false } : c)));
  }
  function setMoverDireto(key: string) {
    setContas((prev) => prev.map((c) => (c.key === key ? { ...c, pertence: false, moverDireto: true } : c)));
  }
  function ocultar(key: string) {
    setContas((prev) => prev.map((c) => (c.key === key ? { ...c, oculta: true } : c)));
  }
  function mostrarTodas() {
    setContas((prev) => prev.map((c) => ({ ...c, oculta: false })));
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>
        A IA identificou as contas abaixo nos <strong>{totalArquivos} arquivo{totalArquivos !== 1 ? "s" : ""}</strong> enviados.
        Indique quais <strong>pertencem a {empresaNome}</strong>.
      </p>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>
        As contas que não pertencem podem ser removidas da tela — os arquivos irão para <strong>Aguardando Aprovação</strong>, onde você decide o destino.
      </p>

      {visiveis.length === 0 && contas.length > 0 && (
        <div style={{ padding: "16px", background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Todas as contas foram ocultadas.{" "}
          <button onClick={mostrarTodas} style={{ background: "none", border: "none", color: "#c4a030", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            Mostrar todas
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {visiveis.map((conta) => (
          <ContaCardUI key={conta.key} conta={conta} onToggle={toggle} onOcultar={ocultar} onMoverDireto={setMoverDireto} />
        ))}
      </div>

      {moverDiretoContas.length > 0 && (
        <div style={{ marginBottom: 8, padding: "8px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e40af" }}>
          → {moverDiretoContas.flatMap((c) => c.arquivos).length} arquivo{moverDiretoContas.flatMap((c) => c.arquivos).length !== 1 ? "s" : ""} serão enviados diretamente para: {moverDiretoContas.map((c) => c.empresaNome ?? c.empresaSugeridaId).join(", ")}
        </div>
      )}

      {ocultas.length > 0 && (
        <div style={{ marginBottom: 16, padding: "8px 14px", background: "#faf5ff", border: "1px solid #ddd6fe", borderRadius: 8, fontSize: 12, color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{ocultas.length} conta{ocultas.length !== 1 ? "s" : ""} oculta{ocultas.length !== 1 ? "s" : ""} — {ocultas.flatMap((c) => c.arquivos).length} arquivo{ocultas.flatMap((c) => c.arquivos).length !== 1 ? "s" : ""} irão para Aguardando Aprovação</span>
          <button onClick={mostrarTodas} style={{ background: "none", border: "none", color: "#7c3aed", cursor: "pointer", fontWeight: 600, fontSize: 12, textDecoration: "underline" }}>
            Mostrar
          </button>
        </div>
      )}

      {erros.length > 0 && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c", marginBottom: 4 }}>✗ Falha ao processar:</p>
          {erros.map((arq, i) => (
            <p key={i} style={{ fontSize: 12, color: "#7f1d1d" }}>{arq.nome_arquivo}: {arq.erro}</p>
          ))}
        </div>
      )}

      {contas.length === 0 && (
        <div style={{ padding: 20, background: "#fefce8", borderRadius: 8, fontSize: 13, color: "#d97706" }}>
          Nenhuma informação de conta foi identificada nos arquivos.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button onClick={onNext}
          style={{ padding: "10px 28px", background: "#c4a030", color: "#0c1a2e", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {ocultas.length > 0 && visiveis.length === 0 ? `Enviar ${ocultas.flatMap((c) => c.arquivos).length} arquivo(s) para Aguardando Aprovação →` : "Revisar arquivos →"}
        </button>
        <button onClick={onVoltar}
          style={{ padding: "10px 18px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
          ← Voltar
        </button>
      </div>
    </div>
  );
}

function ContaCardUI({ conta, onToggle, onOcultar, onMoverDireto }: {
  conta: ContaCard;
  onToggle: (key: string, pertence: boolean) => void;
  onOcultar: (key: string) => void;
  onMoverDireto: (key: string) => void;
}) {
  const isUnknown = conta.key.startsWith("unknown_");
  const bg = conta.moverDireto ? "#eff6ff" : conta.pertence ? "#f0fdf4" : "#fef2f2";
  const border = conta.moverDireto ? "#bfdbfe" : conta.pertence ? "#bbf7d0" : "#fca5a5";

  return (
    <div style={{ padding: "12px 14px", background: bg, border: `1px solid ${border}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        {/* Informações da conta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isUnknown ? (
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
              Arquivo não identificado
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", fontSize: 12 }}>
              {conta.cnpj && (
                <span style={{ color: "#374151" }}>
                  <span style={{ color: "#9ca3af" }}>CNPJ: </span>
                  <strong>{_formatCnpj(conta.cnpj)}</strong>
                </span>
              )}
              {conta.empresaNome && (
                <span style={{ color: "#374151" }}>
                  <span style={{ color: "#9ca3af" }}>Empresa: </span>
                  <strong>{conta.empresaNome}</strong>
                </span>
              )}
              {conta.banco && (
                <span style={{ color: "#374151" }}>
                  <span style={{ color: "#9ca3af" }}>Banco: </span>{conta.banco}
                </span>
              )}
              {conta.conta && (
                <span style={{ color: "#374151" }}>
                  <span style={{ color: "#9ca3af" }}>CC: </span>{conta.conta}
                </span>
              )}
            </div>
          )}
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
            {conta.arquivos.length} arquivo{conta.arquivos.length !== 1 ? "s" : ""}: {conta.arquivos.map((a) => a.nome_arquivo).join(", ").slice(0, 80)}{conta.arquivos.map((a) => a.nome_arquivo).join(", ").length > 80 ? "…" : ""}
          </p>
        </div>

        {/* Botões de decisão */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => onToggle(conta.key, true)}
              style={{ padding: "5px 12px", background: conta.pertence && !conta.moverDireto ? "#16a34a" : "white", color: conta.pertence && !conta.moverDireto ? "white" : "#16a34a", border: "1px solid #16a34a", borderRadius: 6, fontSize: 12, fontWeight: conta.pertence && !conta.moverDireto ? 700 : 400, cursor: "pointer" }}>
              ✓ Pertence
            </button>
            <button onClick={() => onToggle(conta.key, false)}
              style={{ padding: "5px 12px", background: !conta.pertence && !conta.moverDireto ? "#b91c1c" : "white", color: !conta.pertence && !conta.moverDireto ? "white" : "#b91c1c", border: "1px solid #b91c1c", borderRadius: 6, fontSize: 12, fontWeight: !conta.pertence && !conta.moverDireto ? 700 : 400, cursor: "pointer" }}>
              ✗ Não pertence
            </button>
          </div>
          {conta.empresaSugeridaId && (
            <button onClick={() => onMoverDireto(conta.key)}
              style={{ padding: "5px 12px", background: conta.moverDireto ? "#2563eb" : "white", color: conta.moverDireto ? "white" : "#2563eb", border: "1px solid #2563eb", borderRadius: 6, fontSize: 12, fontWeight: conta.moverDireto ? 700 : 400, cursor: "pointer", textAlign: "center" }}>
              {conta.moverDireto ? "✓ " : ""}→ Enviar para {conta.empresaNome ?? conta.empresaSugeridaId}
            </button>
          )}
          {!conta.pertence && !conta.moverDireto && (
            <button onClick={() => onOcultar(conta.key)}
              style={{ padding: "4px 10px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 11, cursor: "pointer", textAlign: "center" }}>
              Remover da tela
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Etapa 3: Revisão de arquivos ───────────────────────────────────────────

function ArquivosRevisaoStep({
  contas, gruposFormatos, setGruposFormatos, arquivosSemTipo, setArquivosSemTipo, onConfirmar, onVoltar,
}: {
  contas: ContaCard[];
  gruposFormatos: GrupoFormatos[];
  setGruposFormatos: React.Dispatch<React.SetStateAction<GrupoFormatos[]>>;
  arquivosSemTipo: ArquivoSemTipo[];
  setArquivosSemTipo: React.Dispatch<React.SetStateAction<ArquivoSemTipo[]>>;
  onConfirmar: () => void;
  onVoltar: () => void;
}) {
  const gruposFormatosIds = new Set(gruposFormatos.flatMap((g) => g.arquivos.map((a) => a.id)));
  const semTipoIds = new Set(arquivosSemTipo.map((a) => a.arquivo.id));

  const pertenceArquivos = contas
    .filter((c) => c.pertence && !c.oculta && !c.moverDireto)
    .flatMap((c) => c.arquivos)
    .filter((a) => !!a.id);

  const naoPertenceArquivos = contas
    .filter((c) => (!c.pertence || c.oculta) && !c.moverDireto)
    .flatMap((c) => c.arquivos)
    .filter((a) => !!a.id);

  const moverDiretoArquivos = contas
    .filter((c) => c.moverDireto)
    .flatMap((c) => c.arquivos)
    .filter((a) => !!a.id);

  const prontos = pertenceArquivos.filter(
    (a) => a.tipo && !gruposFormatosIds.has(a.id) && !semTipoIds.has(a.id),
  );

  function toggleManter(grupoKey: string, arqId: string) {
    setGruposFormatos((prev) =>
      prev.map((g) => {
        if (g.key !== grupoKey) return g;
        const nova = g.manter.includes(arqId) ? g.manter.filter((id) => id !== arqId) : [...g.manter, arqId];
        return { ...g, manter: nova };
      }),
    );
  }

  function setTipo(arqId: string, tipo: string | null) {
    setArquivosSemTipo((prev) =>
      prev.map((a) => (a.arquivo.id === arqId ? { ...a, tipoSelecionado: tipo } : a)),
    );
  }

  const semTipoSemClassif = arquivosSemTipo.filter((a) => !a.tipoSelecionado).length;
  const totalFilaGlobal = naoPertenceArquivos.length + semTipoSemClassif;

  return (
    <div>
      <p style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>
        Revise os arquivos das contas confirmadas. Clique em <strong>Confirmar e salvar</strong> para finalizar.
      </p>

      {/* Prontos para salvar */}
      {prontos.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>
            ✓ Prontos para salvar ({prontos.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {prontos.map((arq) => (
              <div key={arq.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, fontSize: 12 }}>
                <span style={{ color: "#16a34a", flexShrink: 0 }}>✓</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>{arq.nome_arquivo}</span>
                <span style={{ color: "#9ca3af", flexShrink: 0 }}>{TIPO_LABEL[arq.tipo ?? ""] ?? arq.tipo}</span>
                {arq.mes_referencia && <span style={{ color: "#9ca3af", flexShrink: 0 }}>{_mesPtBR(arq.mes_referencia)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formatos duplicados */}
      {gruposFormatos.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 4 }}>
            📋 Formatos duplicados ({gruposFormatos.reduce((s, g) => s + g.arquivos.length, 0)} arquivos)
          </h3>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            O mesmo documento foi enviado em múltiplos formatos. Escolha quais manter no sistema — ao gerar lançamentos você decide qual usar.
          </p>
          {gruposFormatos.map((grupo) => {
            const label = [
              TIPO_LABEL[grupo.tipo] ?? grupo.tipo,
              grupo.banco && `${grupo.banco}`,
              grupo.conta && `CC ${grupo.conta}`,
              grupo.mesRef && _mesPtBR(grupo.mesRef),
            ].filter(Boolean).join(" — ");

            return (
              <div key={grupo.key} style={{ padding: "12px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#1e40af", marginBottom: 8 }}>{label}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {grupo.arquivos.map((arq) => {
                    const mantendo = grupo.manter.includes(arq.id);
                    return (
                      <label key={arq.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: mantendo ? "#1e40af" : "#9ca3af" }}>
                        <input type="checkbox" checked={mantendo} onChange={() => toggleManter(grupo.key, arq.id)} style={{ cursor: "pointer" }} />
                        <span style={{ textDecoration: mantendo ? "none" : "line-through" }}>{arq.nome_arquivo}</span>
                        {mantendo && <span style={{ color: "#16a34a", fontWeight: 600 }}>manter</span>}
                        {!mantendo && <span style={{ color: "#9ca3af" }}>descartar</span>}
                      </label>
                    );
                  })}
                </div>
                {grupo.manter.length === 0 && (
                  <p style={{ fontSize: 11, color: "#c2410c", marginTop: 6 }}>⚠ Selecione ao menos 1 arquivo para manter.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Arquivos sem tipo identificado */}
      {arquivosSemTipo.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#d97706", marginBottom: 4 }}>
            ? Não identificados ({arquivosSemTipo.length})
          </h3>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            A IA não conseguiu identificar o tipo destes arquivos. Classifique-os manualmente ou deixe em branco para enviar para Aguardando Aprovação.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {arquivosSemTipo.map((item) => (
              <div key={item.arquivo.id} style={{ padding: "10px 12px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{item.arquivo.nome_arquivo}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select
                    value={item.tipoSelecionado || ""}
                    onChange={(e) => setTipo(item.arquivo.id, e.target.value || null)}
                    style={{ flex: 1, padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 12, background: "white" }}
                  >
                    <option value="">— Selecionar tipo (opcional) —</option>
                    {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {!item.tipoSelecionado && (
                    <span style={{ fontSize: 11, color: "#7c3aed", flexShrink: 0 }}>→ Aguardando Aprovação</span>
                  )}
                  {item.tipoSelecionado && (
                    <span style={{ fontSize: 11, color: "#16a34a", flexShrink: 0 }}>→ Será salvo</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumo de mover direto */}
      {moverDiretoArquivos.length > 0 && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e40af" }}>
          → <strong>{moverDiretoArquivos.length} arquivo{moverDiretoArquivos.length !== 1 ? "s" : ""}</strong> serão enviados diretamente para:{" "}
          {contas.filter((c) => c.moverDireto).map((c) => c.empresaNome ?? c.empresaSugeridaId).join(", ")}
        </div>
      )}

      {/* Resumo da fila global */}
      {totalFilaGlobal > 0 && (
        <div style={{ marginBottom: 24, padding: "10px 14px", background: "#faf5ff", border: "1px solid #ddd6fe", borderRadius: 8, fontSize: 12, color: "#7c3aed" }}>
          <strong>{totalFilaGlobal} arquivo{totalFilaGlobal !== 1 ? "s" : ""}</strong> irá{totalFilaGlobal !== 1 ? "o" : ""} para Aguardando Aprovação após o envio.
          Acesse <Link href="/dashboard/fila-global" style={{ color: "#7c3aed", fontWeight: 600 }}>Aguardando Aprovação</Link> para mover para a empresa certa ou excluir.
        </div>
      )}

      {pertenceArquivos.length === 0 && naoPertenceArquivos.length === 0 && (
        <div style={{ padding: 20, background: "#f0fdf4", borderRadius: 8, fontSize: 13, color: "#16a34a" }}>
          Nenhum arquivo disponível para salvar.
        </div>
      )}

      {/* Verificação: algum grupo de formato sem nenhum arquivo marcado */}
      {gruposFormatos.some((g) => g.manter.length === 0) && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#b91c1c", marginBottom: 12 }}>
          ⚠ Em cada grupo de formatos duplicados, selecione ao menos 1 arquivo para manter.
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onConfirmar}
          disabled={gruposFormatos.some((g) => g.manter.length === 0)}
          style={{
            padding: "10px 28px",
            background: gruposFormatos.some((g) => g.manter.length === 0) ? "#e5e7eb" : "#c4a030",
            color: gruposFormatos.some((g) => g.manter.length === 0) ? "#9ca3af" : "#0c1a2e",
            border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14,
            cursor: gruposFormatos.some((g) => g.manter.length === 0) ? "not-allowed" : "pointer",
          }}
        >
          Confirmar e salvar →
        </button>
        <button onClick={onVoltar}
          style={{ padding: "10px 18px", background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
          ← Voltar
        </button>
      </div>
    </div>
  );
}

// ── StepBar ────────────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const etapas = [
    { keys: ["selecao", "scan_loading"],                                   label: "1 · Selecionar" },
    { keys: ["contas_identificacao"],                                       label: "2 · Contas" },
    { keys: ["arquivos_revisao", "confirm_loading", "resultado"],          label: "3 · Arquivos" },
  ];
  const stepIdx = etapas.findIndex((e) => (e.keys as string[]).includes(step));

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

// ── Resultado row ──────────────────────────────────────────────────────────

function ResultadoRow({ resultado, onPreview, previewLoading }: {
  resultado: ResultadoFinal;
  onPreview: (docId: string) => void;
  previewLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { status } = resultado;
  const cfg = ({
    classificado:          { icon: "✓",  color: "#16a34a", bg: "#f0fdf4",  label: "Classificado" },
    movido_empresa:        { icon: "→",  color: "#2563eb", bg: "#eff6ff",  label: "Movido" },
    duplicata:             { icon: "⚠",  color: "#c2410c", bg: "#fff7ed",  label: "Duplicata" },
    nao_reconhecido:       { icon: "?",  color: "#d97706", bg: "#fefce8",  label: "Não identificado" },
    aguardando_roteamento: { icon: "📋", color: "#7c3aed", bg: "#faf5ff",  label: "Aguardando Aprovação" },
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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {resultado.nome_arquivo}
          </span>
          {status === "duplicata" && resultado.duplicata_nome_arquivo && (
            <span style={{ fontSize: 11, color: "#c2410c", display: "block", marginTop: 1 }}>
              Conflita com: <strong>{resultado.duplicata_nome_arquivo}</strong>
            </span>
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
            style={{ padding: "3px 10px", background: "white", color: "#c2410c", border: "1px solid #c2410c", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: isLoadingOriginal ? "not-allowed" : "pointer", opacity: isLoadingOriginal ? 0.6 : 1, flexShrink: 0 }}>
            {isLoadingOriginal ? "…" : "👁 Original"}
          </button>
        )}
        <button onClick={() => setExpanded((v) => !v)}
          style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 8px", cursor: "pointer", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px" }}>
            {resultado.tipo && <Detail label="Tipo" value={TIPO_LABEL[resultado.tipo] ?? resultado.tipo} />}
            {resultado.banco && <Detail label="Banco" value={resultado.banco} />}
            {resultado.conta && <Detail label="Conta" value={resultado.conta} />}
            {resultado.mes_referencia && <Detail label="Mês" value={_mesPtBR(resultado.mes_referencia)} />}
            {resultado.nome_sugerido && <Detail label="Nome sugerido" value={resultado.nome_sugerido} highlight />}
          </div>
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

// ── Helpers ────────────────────────────────────────────────────────────────

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

function _formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
