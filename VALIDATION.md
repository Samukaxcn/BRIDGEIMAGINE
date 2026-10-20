# Validação da versão 0.2.0

Ambiente local: Linux x64 na nuvem, Node.js 24.18.0, Electron 44.9.1, Playwright 1.58.2 e Xvfb.

- Dez testes de arquivos, navegação e preferências: renomeação com nomes sobrepostos, bloqueio de colisões e alterações externas, persistência de estrelas/rótulos, navegação acima da pasta inicial, voltar/avançar, falha sem alterar a pasta atual, Este Computador, árvore de pastas, raízes Windows/UNC, migração do catálogo 0.1.0 e validação de atalhos.
- Teste de interface com Electron real: revisão com seleção única e múltipla, setas e botões anterior/próxima, circulação entre início e fim, foco deixado em um seletor, retirada/restauração sem excluir arquivos (inclusive seleção vazia), rótulo na foto atual, nomes/atalhos mantidos após recarregar, tela cheia nativa, duplo clique em pastas, pasta superior fora da raiz inicial, endereço digitado, histórico, Este Computador e renomeação.
- O workflow Windows release executa esses testes em Windows e só publica o pacote se todos os passos anteriores forem aprovados. Os resultados ficam disponíveis na aba Actions do GitHub.

O teste usa imagens sintéticas e pastas temporárias. Não há acesso ao computador do usuário; o funcionamento no compartilhamento de rede particular e nas fotografias reais ainda depende de verificação no ambiente do usuário.
