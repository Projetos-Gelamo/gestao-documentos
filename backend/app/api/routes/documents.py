import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query

from app.core.supabase import STORAGE_BUCKET, get_supabase
from app.models.schemas import Documento, DocumentoUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documentos", tags=["documentos"])


@router.get("/", response_model=list[Documento])
async def list_documentos(
    empresa_id: UUID | None = Query(None),
    mes_referencia: str | None = Query(None, description="Formato YYYY-MM"),
    status: str | None = Query(None),
):
    supabase = get_supabase()
    query = supabase.schema("gestao_docs").from_("documento").select("*")
    if empresa_id:
        query = query.eq("empresa_id", str(empresa_id))
    if mes_referencia:
        query = query.eq("mes_referencia", mes_referencia)
    if status:
        query = query.eq("status", status)
    else:
        # Oculta excluídos por padrão
        query = query.neq("status", "excluido")
    res = query.order("detectado_em", desc=True).execute()
    return res.data or []


@router.get("/{documento_id}", response_model=Documento)
async def get_documento(documento_id: UUID):
    supabase = get_supabase()
    res = (
        supabase.schema("gestao_docs").from_("documento")
        .select("*")
        .eq("id", str(documento_id))
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return res.data


@router.patch("/{documento_id}", response_model=Documento)
async def update_documento(documento_id: UUID, update: DocumentoUpdate):
    supabase = get_supabase()
    payload = update.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    res = (
        supabase.schema("gestao_docs").from_("documento")
        .update(payload)
        .eq("id", str(documento_id))
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return res.data[0]


@router.delete("/{documento_id}", status_code=200)
async def delete_documento(
    documento_id: UUID,
    excluido_por: str | None = Header(None, alias="X-Excluido-Por"),
    remover_arquivo: bool = Query(True, description="Remove o arquivo do Storage também"),
):
    """Soft-delete: marca excluido_em/excluido_por. Remove arquivo do Storage se solicitado."""
    supabase = get_supabase()

    # Busca o documento para obter o storage_path
    res = (
        supabase.schema("gestao_docs").from_("documento")
        .select("id,storage_path,nome_arquivo,excluido_em")
        .eq("id", str(documento_id))
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    doc = res.data
    if doc.get("excluido_em"):
        raise HTTPException(status_code=409, detail="Documento já foi excluído anteriormente")

    agora = datetime.now(timezone.utc).isoformat()

    # Soft-delete no banco
    supabase.schema("gestao_docs").from_("documento").update({
        "excluido_em": agora,
        "excluido_por": excluido_por or "sistema",
        "status": "excluido",
    }).eq("id", str(documento_id)).execute()

    # Remove da fila de revisão se estiver lá
    try:
        supabase.schema("gestao_docs").from_("fila_revisao").delete().eq(
            "documento_id", str(documento_id)
        ).execute()
    except Exception:
        pass

    # Remove arquivo do Storage
    storage_removed = False
    if remover_arquivo and doc.get("storage_path"):
        try:
            supabase.storage.from_(STORAGE_BUCKET).remove([doc["storage_path"]])
            storage_removed = True
        except Exception as exc:
            logger.warning("Não foi possível remover arquivo do Storage: %s", exc)

    return {
        "id": str(documento_id),
        "nome_arquivo": doc["nome_arquivo"],
        "excluido_em": agora,
        "excluido_por": excluido_por or "sistema",
        "arquivo_removido": storage_removed,
    }


@router.post("/{documento_id}/substituir/{original_id}", status_code=200)
async def substituir_duplicata(documento_id: UUID, original_id: UUID):
    """Duplicata: exclui o original do storage e DB, promove o novo para classificado."""
    supabase = get_supabase()
    agora = datetime.now(timezone.utc).isoformat()

    orig = (
        supabase.schema("gestao_docs").from_("documento")
        .select("id,storage_path,excluido_em")
        .eq("id", str(original_id))
        .single()
        .execute()
    )
    if orig.data and not orig.data.get("excluido_em"):
        if orig.data.get("storage_path"):
            try:
                supabase.storage.from_(STORAGE_BUCKET).remove([orig.data["storage_path"]])
            except Exception as exc:
                logger.warning("Storage remove falhou ao substituir: %s", exc)
        supabase.schema("gestao_docs").from_("documento").update({
            "excluido_em": agora,
            "excluido_por": "sistema",
            "status": "excluido",
        }).eq("id", str(original_id)).execute()

    supabase.schema("gestao_docs").from_("documento").update({
        "status": "classificado",
    }).eq("id", str(documento_id)).execute()

    return {"ok": True, "original_excluido": str(original_id), "novo_classificado": str(documento_id)}


@router.post("/{documento_id}/manter-duplicata", status_code=200)
async def manter_duplicata(documento_id: UUID):
    """Duplicata: mantém ambos os arquivos e classifica o novo."""
    supabase = get_supabase()
    supabase.schema("gestao_docs").from_("documento").update({
        "status": "classificado",
    }).eq("id", str(documento_id)).execute()
    return {"ok": True, "novo_status": "classificado"}


@router.post("/{documento_id}/mover-empresa/{empresa_destino_id}", status_code=200)
async def mover_empresa(documento_id: UUID, empresa_destino_id: UUID):
    """Empresa errada: move o documento para a empresa correta e classifica."""
    supabase = get_supabase()

    emp = (
        supabase.schema("gestao_docs").from_("empresa")
        .select("id")
        .eq("id", str(empresa_destino_id))
        .single()
        .execute()
    )
    if not emp.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Empresa destino não encontrada")

    supabase.schema("gestao_docs").from_("documento").update({
        "empresa_id": str(empresa_destino_id),
        "status": "classificado",
    }).eq("id", str(documento_id)).execute()

    try:
        supabase.schema("gestao_docs").from_("fila_revisao").delete().eq(
            "documento_id", str(documento_id)
        ).execute()
    except Exception:
        pass

    return {"ok": True, "empresa_destino_id": str(empresa_destino_id)}


@router.post("/{documento_id}/classificar-manual", status_code=200)
async def classificar_manual(documento_id: UUID, update: DocumentoUpdate):
    """Não reconhecido: classifica manualmente pelo usuário."""
    supabase = get_supabase()

    payload = update.model_dump(exclude_none=True)
    payload["status"] = "classificado"
    payload["classificado_em"] = datetime.now(timezone.utc).isoformat()

    res = (
        supabase.schema("gestao_docs").from_("documento")
        .update(payload)
        .eq("id", str(documento_id))
        .execute()
    )
    if not res.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    try:
        supabase.schema("gestao_docs").from_("fila_revisao").delete().eq(
            "documento_id", str(documento_id)
        ).execute()
    except Exception:
        pass

    return res.data[0]


@router.get("/{documento_id}/preview")
def preview_documento(documento_id: UUID):
    """Retorna URL assinada (5 min) para visualizar o arquivo no Storage."""
    supabase = get_supabase()
    try:
        doc = (
            supabase.schema("gestao_docs").from_("documento")
            .select("storage_path,nome_arquivo")
            .eq("id", str(documento_id))
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    if not doc.data or not doc.data.get("storage_path"):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    try:
        result = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(
            doc.data["storage_path"], 300
        )
        url = result.get("signedURL") or result.get("signed_url", "")
        if not url:
            raise HTTPException(status_code=500, detail="Não foi possível gerar URL de preview")
        return {"url": url, "nome_arquivo": doc.data.get("nome_arquivo", "")}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Erro ao criar signed URL: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro ao gerar preview: {exc}")
