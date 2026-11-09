from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class DocumentoStatus(str, Enum):
    pendente = "pendente"
    classificado = "classificado"
    pasta_errada = "pasta_errada"
    em_revisao = "em_revisao"
    revisado = "revisado"
    nao_reconhecido = "nao_reconhecido"
    duplicata = "duplicata"
    empresa_errada = "empresa_errada"
    excluido = "excluido"


class PerfilFuncionario(str, Enum):
    funcionario = "funcionario"
    gestor = "gestor"


class TipoErro(str, Enum):
    pasta_errada = "pasta_errada"
    pendente_revisao = "pendente_revisao"


class PeriodicidadeDocumento(str, Enum):
    mensal = "mensal"
    trimestral = "trimestral"
    anual = "anual"
    avulso = "avulso"


# ---------------------------------------------------------------------------
# Empresa
# ---------------------------------------------------------------------------

class EmpresaBase(BaseModel):
    codigo: str
    cnpj: str
    nome: str
    pasta_id_drive: str | None = None
    ficticio: bool = False


class EmpresaCreate(EmpresaBase):
    pass


class Empresa(EmpresaBase):
    id: UUID

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Tipo de documento esperado por empresa
# ---------------------------------------------------------------------------

class TipoDocumentoEsperadoBase(BaseModel):
    empresa_id: UUID
    tipo: str
    periodicidade: PeriodicidadeDocumento = PeriodicidadeDocumento.mensal
    banco: str | None = None
    conta: str | None = None
    agencia: str | None = None
    descricao: str | None = None


class TipoDocumentoEsperadoCreate(TipoDocumentoEsperadoBase):
    pass


class TipoDocumentoEsperado(TipoDocumentoEsperadoBase):
    id: UUID

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Documento
# ---------------------------------------------------------------------------

class DocumentoBase(BaseModel):
    empresa_id: UUID
    arquivo_id_drive: str | None = None
    storage_path: str | None = None
    nome_arquivo: str
    tipo: str | None = None
    mes_referencia: str | None = None  # formato YYYY-MM
    status: DocumentoStatus = DocumentoStatus.pendente
    cnpj_extraido: str | None = None
    banco: str | None = None
    conta: str | None = None
    confianca: float | None = None
    ficticio: bool = False


class DocumentoCreate(DocumentoBase):
    pass


class DocumentoUpdate(BaseModel):
    tipo: str | None = None
    mes_referencia: str | None = None
    status: DocumentoStatus | None = None
    cnpj_extraido: str | None = None
    banco: str | None = None
    conta: str | None = None
    confianca: float | None = None
    classificado_em: datetime | None = None


class Documento(DocumentoBase):
    id: UUID
    detectado_em: datetime
    classificado_em: datetime | None = None
    excluido_em: datetime | None = None
    excluido_por: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Fila de revisão
# ---------------------------------------------------------------------------

class FilaRevisaoBase(BaseModel):
    documento_id: UUID
    funcionario_id: UUID | None = None


class FilaRevisaoCreate(FilaRevisaoBase):
    pass


class FilaRevisao(FilaRevisaoBase):
    id: UUID
    criado_em: datetime
    resolvido_em: datetime | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Funcionário
# ---------------------------------------------------------------------------

class FuncionarioBase(BaseModel):
    nome: str
    email: str
    perfil: PerfilFuncionario = PerfilFuncionario.funcionario


class FuncionarioCreate(FuncionarioBase):
    usuario_id: UUID


class Funcionario(FuncionarioBase):
    id: UUID
    usuario_id: UUID

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Relatório de erro
# ---------------------------------------------------------------------------

class RelatorioErroBase(BaseModel):
    data: datetime
    empresa_id: UUID | None = None
    documento_id: UUID | None = None
    tipo_erro: TipoErro


class RelatorioErroCreate(RelatorioErroBase):
    pass


class RelatorioErro(RelatorioErroBase):
    id: UUID
    notificado_em: datetime | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Resultado de classificação (interno — não persiste diretamente)
# ---------------------------------------------------------------------------

class ClassificationResult(BaseModel):
    doc_type: str | None = None
    mes_referencia: str | None = None  # formato YYYY-MM
    cnpj: str | None = None
    banco: str | None = None
    conta: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    raw_response: str = ""


# ---------------------------------------------------------------------------
# Resultado de upload (retornado ao frontend)
# ---------------------------------------------------------------------------

class UploadResult(BaseModel):
    id: str
    nome_arquivo: str
    storage_path: str
    tipo: str | None
    mes_referencia: str | None
    banco: str | None
    conta: str | None
    cnpj: str | None
    confidence: float
    status: DocumentoStatus
    na_fila_revisao: bool
    nome_sugerido: str | None
    duplicata_de: str | None = None          # id do documento já existente, se duplicata
    cnpj_empresa_esperado: str | None = None  # CNPJ da empresa destino (para alerta empresa_errada)


# ---------------------------------------------------------------------------
# Item do checklist mensal
# ---------------------------------------------------------------------------

class ChecklistItem(BaseModel):
    tipo_id: str
    tipo: str
    descricao: str
    banco: str | None
    conta: str | None
    recebido: bool
    documento_id: str | None = None
    documento_nome: str | None = None


class ChecklistMensal(BaseModel):
    mes: str
    empresa_id: str
    total: int
    recebidos: int
    pendentes: int
    itens: list[ChecklistItem]
