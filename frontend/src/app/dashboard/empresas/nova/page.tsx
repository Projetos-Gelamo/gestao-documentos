import Link from 'next/link';
import { criarEmpresa } from '@/app/actions/empresa';

export default async function NovaEmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/dashboard/empresas" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>
          ← Empresas
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Nova Empresa</h1>
      </div>

      <div style={{ background: 'white', borderRadius: 10, padding: 28, maxWidth: 520, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        {erro && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 20, color: '#b91c1c', fontSize: 13 }}>
            {decodeURIComponent(erro)}
          </div>
        )}

        <form action={criarEmpresa}>
          <Field label="Nome da empresa" name="nome" required placeholder="Ex: Empresa Alfa Comércio Ltda" />
          <Field label="CNPJ" name="cnpj" required placeholder="00.000.000/0001-00" />
          <Field label="Código interno" name="codigo" required placeholder="Ex: EMP001" />

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>
              ID da pasta no Google Drive
              <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 400 }}> (opcional — pode adicionar depois)</span>
            </label>
            <input name="pasta_id_drive" style={inputStyle} placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs" />
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              Abra a pasta da empresa no Google Drive → copie o ID que aparece na URL após /folders/
            </p>
          </div>

          <button
            type="submit"
            style={{
              background: '#2563eb', color: 'white', border: 'none', borderRadius: 6,
              padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%',
            }}
          >
            Criar empresa
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, name, required, placeholder,
}: {
  label: string; name: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <input name={name} required={required} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
