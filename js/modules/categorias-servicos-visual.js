// Apresentação local das categorias principais. Não altera o cadastro no Firebase.
const lotus = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 6c-5 5-8 10-8 15s3 9 8 13c5-4 8-8 8-13S29 11 24 6Z"/><path d="M18 22C13 17 8 17 4 18c1 10 6 15 16 16M30 22c5-5 10-5 14-4-1 10-6 15-16 16M7 37c10 5 24 5 34 0M16 35c-3 0-6 1-8 3m24-3c3 0 6 1 8 3"/></svg>`;
const hair = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M7 39c7-9 17 4 24-5 6-8-2-16 3-23M9 33c7-8 15 5 19-5 3-7-4-14 3-19M12 26c5-4 8 2 11-4 2-5-1-10 5-13M6 44c9-9 18 4 28-5 10-10 0-19 5-29M16 21c-2-13 7-20 17-17 7 2 8 6 8 10"/></svg>`;
const nail = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 5h8l1 17H19L20 5ZM20 22h8c6 0 9 4 9 9v11H11V31c0-5 3-9 9-9Z"/><rect x="16" y="28" width="16" height="10" rx="2"/><path d="M19 18h10"/></svg>`;
const categorias = {
  estetica: { imagem: '/assets/images/servicos-categoria-estetica.webp', posicao: '50% 48%', icone: lotus, alt: 'Mulher recebendo um tratamento facial em um ambiente acolhedor' },
  cabelo: { imagem: '/assets/images/servicos-categoria-cabelo.webp', posicao: '50% 42%', icone: hair, alt: 'Cabelos longos e ondulados com brilho e acabamento de salão' },
  unhas: { imagem: '/assets/images/servicos-categoria-unhas.webp', posicao: '40% 50%', icone: nail, alt: 'Mãos com manicure delicada em tons claros' }
};
export function apresentacaoCategoriaServico(nome) {
  const chave = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return categorias[chave] || null;
}
