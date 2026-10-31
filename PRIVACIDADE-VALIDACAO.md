# Privacidade, cookies e termos — validação local

Implementação preparada em 31/10/2026. Sem commit, push ou publicação nesta entrega.

## Identificação

Responsável informado pelo usuário: Viviane Vargas. Contato confirmado: vivianefvargas@hotmail.com. Nenhum número de CPF ou CNPJ foi publicado. As páginas descrevem CPF/CNPJ apenas como tipos de dados que o formulário de cadastro já solicita, sem divulgar dados de clientes.

## Arquivos

Criados: `api/terms.js`, `api/metrics.js`, `css/privacy.css`, `js/privacy/consent.js`, `js/privacy/ui.js`, `js/privacy/terms.js`, `pages/politica-de-privacidade.html`, `pages/termos-de-uso.html`, `pages/legal/termos-2026-10-31.html`, `tests/privacy.test.mjs`, `tests/firestore-consent.test.mjs`.

Alterados: `api/_auth.js`, `api/lead-perdido.js`, `firebase/firestore.rules`, `index.html`, `js/app.js`, `js/modules/cart.js`, `js/services/auth.js`, `js/services/firestore.js`, `pages/catalogo.html`, `pages/produto.html`, `pages/servicos.html`, `pages/servico.html`, `pages/privacidade.html`, `tests/reliability.test.mjs`.

Os links jurídicos e de configurações foram adicionados ao rodapé. Os documentos também são consultáveis nos fluxos de cadastro/aceite. Cabeçalho, navegação mobile, logo e loading não foram redesenhados.

## Auditoria do armazenamento e das requisições

- Necessários: sessão Firebase Auth, cache Firestore/IndexedDB, cache de catálogo e perfil, carrinho, favoritos, proteção contra repetição de operações, escolha de cookies e marcador da abertura.
- Opcionais existentes: contagens de visualização/compartilhamento e recuperação de carrinho não finalizado. Não foram encontrados Google Analytics, Meta Pixel ou outros SDKs publicitários.
- Firebase, Vercel, imagens Cloudinary e Google Fonts continuam utilizados para a entrega do site. Esses fornecedores recebem informações técnicas das requisições. Não foram classificados como pixels publicitários.
- `consent.js` é carregado no head antes dos módulos da aplicação. A ausência de preferência válida significa recusa dos opcionais. Os pontos reais de coleta verificam a autorização antes de gravar marcadores ou enviar requisições.
- Preferências ficam em `localStorage['ev:consentimento']`: schema 1, versão da política, data ISO e booleanos das categorias. Validade: 180 dias. Rejeição também é persistida. Storage bloqueado resulta em mensagem real de erro, mantendo as escolhas anteriores; sem escolha anterior, opcionais desligados.
- Revogação bloqueia novas coletas e remove marcadores opcionais locais. Não é possível retirar uma requisição já enviada nem apagar automaticamente dados históricos no servidor apenas limpando cookies; a política informa o canal de solicitação.

## Aceite confiável

1. O servidor verifica o ID token do Firebase, incluindo revogação.
2. GET `/api/terms` informa se a versão vigente já foi aceita; caso contrário, gera desafio aleatório de 15 minutos associado ao UID.
3. POST exige a versão vigente, ação explícita de aceite e o desafio correspondente. Um booleano livre `termsAccepted: true` é recusado.
4. Uma transação grava `aceitesTermos/{uid}` e cria `aceitesTermos/{uid}/historico/{versao}` com UID, versão, caminho do documento, SHA-256 do documento, UUID do evento e `serverTimestamp`. O desafio é removido.
5. Repetir a mesma confirmação não substitui o histórico. Cliente não pode criar, alterar ou excluir esses comprovantes nas regras propostas.
6. O observador de autenticação aguarda a confirmação antes de liberar o usuário à interface. As regras propostas verificam o comprovante nos dados da conta. O helper das APIs administrativas também exige a versão vigente.

A identidade do Firebase Authentication pode existir antes do aceite: isso não significa conta liberada. Falhas mantêm o acesso bloqueado, encerram a sessão e orientam nova entrada para concluir o processo. Um perfil mínimo pode ser recuperado no próximo login depois do aceite. Dados de cadastro não gravados antes da falha podem precisar ser informados novamente.

O projeto possui apenas provedor de e-mail/senha. Não foi criado login Google. O gate central atende o observador de autenticação, mas um novo provedor deve ser validado antes de ser disponibilizado.

## Regras e segurança

O arquivo anterior de regras estava truncado, terminando no comentário de endereços. A versão local foi concluída para as coleções utilizadas. Papéis administrativos não podem ser atribuídos pelo cliente. Perfil, pedidos, endereços, carrinhos e favoritos exigem conta liberada e vínculo de propriedade; coleções administrativas continuam restritas. Desafios são inacessíveis ao cliente. O grafo de funções não tem recursão: `ehAdmin → contaLiberada → autenticado`.

Não foram adicionadas credenciais ao navegador nem usado Firebase Storage. As funções reutilizam Firebase Admin e a infraestrutura Vercel já presentes. Credenciais necessárias no servidor: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Sua existência em produção não foi verificada.

## Testes realizados

- A: banner em sessão limpa sem login — passou no navegador, 1440 px e 390 px.
- B: rejeição oculta banner e salva booleans falsos — passou no navegador. Nenhuma requisição às funções opcionais foi observada. Teste separado executou as funções reais de métricas/lead com dependências simuladas e confirmou zero requisições sem autorização.
- C: recarregar e navegar à política mantém a decisão — passou no navegador.
- D: rodapé reabre modal; categorias independentes são salvas e revogadas — passou no navegador.
- E: cadastro sem aceite não chama criação de identidade — passou em teste do serviço real com Firebase simulado.
- F: cadastro com aceite confirma o desafio na função real, grava o comprovante e só depois grava o perfil — passou com banco e autenticação simulados.
- G: token inválido, desafio de outro UID, booleano livre, desafio expirado e versão errada são recusados — passou nos testes da API. A verificação das regras em chamadas diretas ao Firestore ainda não foi executada: teste de emulador ficou explicitamente SKIP.
- H: falha de rede não libera conta nem grava perfil; storage bloqueado não exibe falso sucesso — passou nos testes de serviço e no navegador.
- I: Google/outros provedores — não aplicável ao projeto atual; não foram testados provedores inexistentes.
- J: banner, modal, links e páginas sem overflow horizontal — passou em 1440 px e 390 px.

Resultado automatizado: 24 testes aprovados, 0 falhas, 1 teste de regras pulado. Testes existentes de carrinho, pedidos, WhatsApp, conta, servidor e loading também passaram. `git diff --check` passou.

Os testes de navegador serviram os arquivos locais e bloquearam serviços externos; não criaram contas nem gravaram dados reais. As verificações de API usaram o código real das funções com mocks de Firebase. Não equivalem à homologação com as credenciais, regras e dados reais.

## Pendências antes da publicação

1. Validar as regras no emulador. O teste `tests/firestore-consent.test.mjs` usa exclusivamente `demo-ev-privacy` e um host local. Não havia Java/emulador configurado e havia somente cerca de 81 MiB livres na unidade, insuficientes para preparar esse ambiente com segurança nesta execução.
2. Validar em ambiente de homologação o cadastro, falhas e recuperação com Firebase Auth/Firestore reais e as variáveis da Vercel. Não há comprovação de produção nesta entrega.
3. Publicar as regras e as funções de maneira coordenada antes de liberar o recurso ao público. Somente fazer push do HTML/JS não publica regras do Firestore. As novas regras passarão a exigir aceite também para contas existentes, inclusive administradores; todos precisarão confirmar a versão ao entrar.
4. Confirmar com a responsável o enquadramento jurídico e as rotinas reais de retenção, atendimento a direitos e transferências internacionais. Não foram inventados CNPJ, prazos gerais de descarte, região do banco ou procedimentos empresariais. A implementação não certifica conformidade legal integral.

## Atualizações dos documentos

O snapshot em `pages/legal/termos-2026-10-31.html` deve ser preservado depois da publicação. Mudança relevante: criar novo snapshot e hash, alterar a versão em `api/terms.js`, `api/_auth.js` e nas regras, e coordenar a nova publicação. Ajustes editoriais sem efeito material não devem forçar novo aceite; mantenha preservado o documento efetivamente aceito.

## Referências oficiais consultadas

- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- CDC: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Marco Civil: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- Guia ANPD: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf
- Firebase privacidade: https://firebase.google.com/support/privacy
- Emulador: https://firebase.google.com/docs/emulator-suite/install_and_configure
