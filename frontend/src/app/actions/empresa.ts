'use server'

import { redirect } from 'next/navigation';

export async function criarEmpresa(formData: FormData) {
  const nome = (formData.get('nome') as string).trim();
  const cnpj = (formData.get('cnpj') as string).trim();
  const codigo = (formData.get('codigo') as string).trim().toUpperCase();
  const pasta_id_drive = (formData.get('pasta_id_drive') as string | null)?.trim() || null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://gestao-documentos-production.up.railway.app';

  const res = await fetch(`${apiUrl}/empresas/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, cnpj, codigo, pasta_id_drive, ficticio: false }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.detail ?? 'Erro ao criar empresa';
    redirect(`/dashboard/empresas/nova?erro=${encodeURIComponent(msg)}`);
  }

  redirect('/dashboard/empresas');
}
