# BRIDGEIMAGINE — primeira versão

Aplicativo desktop independente para organizar fotografias locais. Implementação própria em Electron; não utiliza executáveis, DLLs, marcas gráficas ou código do Adobe Bridge.

## Windows

O pacote portátil, quando gerado, fica em `dist/BRIDGEIMAGINE 0.1.0.exe`. Abra o executável e clique em **Abrir pasta**. Esta versão não é assinada digitalmente.

Para executar a partir do código, instale Node.js 24 LTS e use PowerShell nesta pasta:

```powershell
npm ci
npm start
```

Para gerar novamente o executável portátil para Windows x64:

```powershell
npm run pack:win
```

O primeiro início/empacotamento baixa os binários do Electron e precisa de internet. Depois, o aplicativo trabalha com arquivos locais, sem servidor e sem credenciais Adobe.

## Funcionalidades implementadas

- Abrir pasta e navegar nas subpastas, voltar ao diretório superior e atualizar.
- Miniaturas para JPEG, PNG, WebP, GIF, BMP e AVIF, conforme os codecs do Electron; outros arquivos aparecem sem prévia.
- Pesquisa pelo nome, filtro por estrelas e tamanho ajustável das miniaturas.
- Seleção com Ctrl, intervalo com Shift e Ctrl+A.
- Estrelas 1–5, Ctrl+0 para limpar, rejeição e rótulos Abertura, Colação, Diploma, Juramento e Pais.
- Espaço abre a foto em tela cheia; esquerda/direita navegam; Esc ou Espaço retorna.
- Ctrl+B abre revisão das fotos selecionadas, ou das imagens visíveis se não houver seleção. Esquerda/direita navegam; **baixo retira apenas da seleção de revisão**; **cima restaura a última retirada**, em ordem inversa. Esc retorna com a seleção restante. Nenhum desses atalhos exclui ou move arquivos.
- Renomeação em lote na mesma pasta: prefixo opcional, sequência inicial e 1–6 dígitos, conservando a extensão. Por exemplo, início 39 e três dígitos gera `039.jpeg`. A prévia é obrigatória. A operação bloqueia colisões e alterações detectadas e aceita sequências com nomes sobrepostos.

Classificações e rótulos ficam no `catalog.json` do diretório de dados do Electron (`%APPDATA%/bridgeimagine` no Windows). **Ainda não são escritos ou importados de XMP/EXIF**, portanto não aparecem automaticamente no Adobe Bridge. Renomeações realizadas neste aplicativo mantêm a associação do catálogo; renomeações externas não são acompanhadas.

## Limites desta entrega

Esta é a versão inicial, não uma reprodução de todas as funções do Adobe Bridge. Ainda não inclui RAW/HEIC/PDF, gerenciamento de cor, zoom/pan, prévias em cache, árvore recursiva completa, vídeo, exportação, presets de renomeação, regras de metadados nem cópia/movimentação em lote. As miniaturas carregam as imagens originais; pastas muito grandes precisam de otimização futura.

A renomeação utiliza links temporários para preservar conteúdo e evitar sobrescritas. Requer um sistema de arquivos com suporte a hard links (NTFS no Windows). Em caso de falha de recuperação, o aplicativo informa as cópias temporárias preservadas para recuperação manual. Não movimente os mesmos arquivos em outro programa durante a operação; quedas abruptas do sistema ainda exigem recuperação manual. Teste primeiro em cópias das fotografias.

## Validação

```powershell
npm test
npm run test:gui
```

Os testes de arquivos verificam colisões, preservação de conteúdo, classificação persistente e bloqueio de navegação fora da raiz. O teste de interface abre o Electron com imagens sintéticas e verifica tela cheia, navegação, revisão sem exclusão, restauração, estrelas e renomeação. Em Linux, o teste gráfico requer DISPLAY/Xvfb e usa `--no-sandbox` apenas no processo de teste; a aplicação mantém isolamento de contexto, renderer sem Node e sandbox configurado. O teste produz `screenshot.png`.

Validação realizada no ambiente Linux da nuvem. O pacote Windows pode ser gerado aqui, mas precisa de validação no seu Windows antes de uso em produção.
