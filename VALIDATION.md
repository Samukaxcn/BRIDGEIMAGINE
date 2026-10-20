# Validação — 20/10/2026

Ambiente de teste: Linux x64 na nuvem, Node.js 24.18.0, Electron 44.9.1, Playwright 1.58.2 e Xvfb.

- `npm test`: 4 testes aprovados. Verificados renomeação com sobreposição de nomes, conteúdo preservado, bloqueio de colisões, detecção de alterações externas, confinamento da navegação e persistência independente de estrelas/rótulos.
- `npm run test:gui`: aprovado com Electron real e três imagens sintéticas. Verificados carregamento da imagem, estado nativo de tela cheia, navegação por setas, saída por Esc, Ctrl+B, remoção/restauração na seleção de revisão, manutenção dos três arquivos no disco, estrelas e aplicação da renomeação a partir de 039.
- JavaScript principal e interface passaram por verificação de sintaxe.
- O pacote contém apenas a implementação própria. Nenhuma DLL ou executável Adobe foi incluído.

O executável Windows x64 é produzido pelo electron-builder. Sua execução no Windows não foi testada neste ambiente Linux. Recursos e limitações da versão estão no README.md.
