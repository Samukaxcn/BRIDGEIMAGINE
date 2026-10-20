# BRIDGEIMAGINE 0.2.0

Aplicativo desktop independente para organizar fotografias locais. Implementação própria em Electron, sem executáveis, DLLs ou recursos gráficos do Adobe Bridge.

## Baixar e usar no Windows

Na [seção Releases](https://github.com/Samukaxcn/BRIDGEIMAGINE/releases), baixe o ZIP da versão mais recente, extraia e execute **BRIDGEIMAGINE.exe**. O pacote é portátil, sem assinatura digital e não requer Adobe Bridge nem Node.js para executar. Feche a versão anterior antes de abrir a nova.

## Navegação pelo computador

- **Este Computador** lista unidades locais e mapeadas. Acesso rápido abre Pasta pessoal, Área de Trabalho, Documentos, Imagens e Downloads.
- Use a árvore à esquerda: clique na seta para expandir ou no nome da pasta para abrir.
- Dê duplo clique nas pastas da grade, use **Pasta acima**, **Voltar** e **Avançar**, ou clique nos componentes do caminho.
- A barra de endereço aceita caminhos completos, por exemplo `C:\Fotos` ou `\\Servidor\ftp2026\AGENCIA RETRATO\Album amostra`. Ctrl+L seleciona o endereço; Enter abre a pasta. No Windows, variáveis como `%USERPROFILE%` são aceitas.
- Alt+← volta, Alt+→ avança, Alt+↑ sobe e F5 atualiza. A navegação pode sair da pasta inicial. Unidades de rede mapeadas são listadas; compartilhamentos UNC são abertos pelo endereço completo, sem descoberta automática de todos os servidores.
- Uma pasta indisponível ou sem permissão gera um aviso e preserva a visualização anterior. `Thumbs.db` e `desktop.ini` não aparecem na grade.

## Tela cheia e revisão

- **Espaço:** foto atual em tela cheia; ←/→ navegam; Esc ou Espaço retorna.
- **Ctrl+B:** revisão em carrossel. Com zero ou uma foto selecionada, abre todas as imagens visíveis, começando pela foto ativa. Com duas ou mais fotos selecionadas, revisa apenas essas imagens.
- **←/→:** foto anterior/próxima. Também há botões na tela; a navegação circula do final para o início e vice-versa.
- **↓:** retira a foto apenas da seleção de revisão. **↑:** restaura a última retirada, em ordem inversa. Mesmo ao retirar todas, ↑ permite restaurar. **Nenhum arquivo é apagado ou movido.** Esc retorna à grade com a seleção restante.
- Os atalhos de rótulo e Ctrl+1–5 funcionam na foto atual durante a revisão/tela cheia. Na grade, aplicam-se aos arquivos selecionados.

## Rótulos e atalhos personalizados

Clique em **Rótulos e atalhos** na barra superior. Altere o nome de cada cor e clique no campo de atalho, depois pressione a tecla ou combinação desejada. Backspace limpa um atalho; **Salvar** aplica e mantém a configuração entre sessões. **Restaurar padrões** prepara os valores originais, que só são aplicados ao salvar.

Padrões baseados nos exemplos enviados:

| Cor | Nome | Atalho |
| --- | --- | --- |
| Vermelho | Abertura | 6 |
| Amarelo | Colação | 7 |
| Verde | Diploma | 8 |
| Azul | Juramento | 9 |
| Rosa | Pais | 5 |

**Ctrl+1 a Ctrl+5** atribuem estrelas; **Ctrl+0** limpa as estrelas. Assim a tecla 5 pode ser usada para Pais. Conflitos entre rótulos e atalhos reservados são bloqueados. Os nomes também aparecem na lateral, na revisão e no menu de botão direito. Mudar o nome de um rótulo mantém a associação com suas fotos.

Configurações ficam em `preferences.json` e classificações em `catalog.json`, no diretório de dados do aplicativo (`%APPDATA%\bridgeimagine` no Windows). O catálogo da versão 0.1.0 é lido, mantendo os rótulos existentes. As classificações ainda não são importadas de ou gravadas em XMP/EXIF.

## Outros recursos

Miniaturas para JPEG, PNG, WebP, GIF, BMP e AVIF conforme os codecs do Electron; busca pelo nome; filtro por estrelas; seleção com Ctrl/Shift e Ctrl+A; navegação de miniaturas por setas; rejeição e tamanho ajustável de miniaturas.

Renomeação em lote na mesma pasta com prefixo opcional, sequência inicial e 1–6 dígitos, preservando a extensão. Início 39 e três dígitos gera `039.jpeg`. A prévia é obrigatória. A operação bloqueia colisões/alterações detectadas e aceita sequências sobrepostas, preservando conteúdo.

A renomeação utiliza hard links temporários (requer NTFS no Windows). Não altere os mesmos arquivos em outro programa durante a operação. Quedas abruptas podem exigir recuperação manual. Se a recuperação automática falhar, o aplicativo informa os caminhos das cópias temporárias preservadas. Teste primeiro em cópias das fotos.

## Limites atuais

Ainda sem RAW/HEIC/PDF, gerenciamento de cor, zoom/pan, vídeo, exportação, regras avançadas/presets de renomeação, cópia/movimentação em lote ou cache de miniaturas. As imagens originais são carregadas para prévia, e pastas muito grandes ainda precisam de otimização. Renomeações externas não são acompanhadas pelo catálogo.

## Executar, testar e gerar o pacote

Instale Node.js 24 LTS e, em PowerShell nesta pasta:

```powershell
npm ci
npm start
npm test
npm run test:gui
npm run pack:win
```

O primeiro início/empacotamento pelo código baixa Electron e precisa de internet; o pacote distribuído já contém o runtime e funciona localmente. O executável gerado fica em `dist/BRIDGEIMAGINE 0.2.0.exe`.

O teste gráfico abre Electron real com imagens sintéticas e verifica regressões da revisão, navegação, atalhos/configurações persistentes e renomeação. Em Linux, requer DISPLAY/Xvfb; `--no-sandbox` é usado somente no processo de teste Linux. O aplicativo mantém isolamento de contexto, renderer sem Node e sandbox configurado. A automação do GitHub executa os testes e gera o pacote em Windows antes de publicar a Release.
