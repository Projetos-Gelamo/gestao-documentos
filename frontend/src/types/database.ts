export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  gestao_docs: {
    Tables: {
      empresa: {
        Row: {
          id: string;
          codigo: string;
          cnpj: string;
          nome: string;
          pasta_id_drive: string | null;
          ultima_verificacao_em: string | null;
          ficticio: boolean;
          criado_em: string;
        };
        Insert: Omit<Database["gestao_docs"]["Tables"]["empresa"]["Row"], "id" | "criado_em">;
        Update: Partial<Database["gestao_docs"]["Tables"]["empresa"]["Insert"]>;
      };
      documento: {
        Row: {
          id: string;
          empresa_id: string;
          arquivo_id_drive: string;
          nome_arquivo: string;
          tipo: string | null;
          mes_referencia: string | null;
          status: "pendente" | "classificado" | "pasta_errada" | "em_revisao" | "revisado" | "nao_reconhecido";
          cnpj_extraido: string | null;
          confianca: number | null;
          ficticio: boolean;
          detectado_em: string;
          classificado_em: string | null;
        };
        Insert: Omit<Database["gestao_docs"]["Tables"]["documento"]["Row"], "id" | "detectado_em">;
        Update: Partial<Database["gestao_docs"]["Tables"]["documento"]["Insert"]>;
      };
      fila_revisao: {
        Row: {
          id: string;
          documento_id: string;
          funcionario_id: string | null;
          criado_em: string;
          resolvido_em: string | null;
        };
        Insert: Omit<Database["gestao_docs"]["Tables"]["fila_revisao"]["Row"], "id" | "criado_em">;
        Update: Partial<Database["gestao_docs"]["Tables"]["fila_revisao"]["Insert"]>;
      };
      funcionario: {
        Row: {
          id: string;
          usuario_id: string;
          nome: string;
          email: string;
          perfil: "funcionario" | "gestor";
        };
        Insert: Omit<Database["gestao_docs"]["Tables"]["funcionario"]["Row"], "id">;
        Update: Partial<Database["gestao_docs"]["Tables"]["funcionario"]["Insert"]>;
      };
      relatorio_erro: {
        Row: {
          id: string;
          data: string;
          empresa_id: string | null;
          documento_id: string | null;
          tipo_erro: "pasta_errada" | "pendente_revisao";
          notificado_em: string | null;
        };
        Insert: Omit<Database["gestao_docs"]["Tables"]["relatorio_erro"]["Row"], "id">;
        Update: Partial<Database["gestao_docs"]["Tables"]["relatorio_erro"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
