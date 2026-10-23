# Espaço Viviane Vargas

Catálogo de produtos e serviços, conta do cliente e atendimento pelo WhatsApp. O site público usa HTML/CSS/JavaScript e Firebase; as funções em `api/` são executadas no servidor pela Vercel.

## Testes locais

Execute `npm test` na pasta do projeto. Os testes usam somente recursos nativos do Node e serviços simulados, sem acessar o banco real. Foram executados com Node 24.22.1. A opção `--experimental-vm-modules` usada pelo teste isola as dependências de Firebase e pode produzir um aviso do Node.

Os testes verificam carrinho antigo, dados inválidos, quantidades, centavos, favoritos, armazenamento bloqueado, WhatsApp bloqueado, clique duplo, histórico, sincronização entre sessões, autenticação do servidor e escape de URLs de imagens.

## Funcionamento dos pedidos

O botão de finalizar abre o WhatsApp para atendimento e confirmação manual. Os itens permanecem no carrinho para permitir retomar a conversa. Clientes conectados geram um pedido pendente no histórico a partir da home, do catálogo ou da página do produto. Abrir a conversa não comprova envio, pagamento ou confirmação de estoque.

Se o navegador bloquear o armazenamento, carrinho e favoritos funcionam temporariamente na memória da página. Nesse caso, os dados temporários não sobrevivem ao fechamento ou recarregamento.

## Validação antes do uso diário

A revisão local não publicou o site nem alterou dados reais, regras do Firebase ou variáveis de produção. Antes da operação diária, valide no ambiente publicado: entrada e saída de uma conta de teste, recuperação de senha, sincronização entre dois dispositivos, pedido de teste e sua visualização no painel, acesso indevido negado e abertura do WhatsApp. Confirme também o processo de backup e restauração no painel administrativo.

Preço e disponibilidade seguem a conferência manual da equipe no WhatsApp. Uma futura confirmação automática de vendas deve validar preços e estoque no servidor e definir a regra de reserva/baixa de estoque.