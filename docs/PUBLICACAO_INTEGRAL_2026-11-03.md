# Publicação integral do acervo demonstrativo

## Auditoria da entrega anterior

Foi auditado o commit de Álvaro `cd49c8118002b6d57965102a0cdefd94c10b03aa`, no PR #67. Ele alterou somente o manifesto: revisou vinte entradas e terminou com 62 candidatas, 47 reservas e uma exclusão. A revisão semântica de oito fotos promovidas foi conferida visualmente: representam uso de navalha na barba, compatível com uma etapa do serviço associado, sem comprovar todas as etapas de um atendimento.

Em leitura READ ONLY, `smartbarber-dev-2`, usado pela API publicada, tinha 62 mídias READY: dez logos, 39 fotos de galeria e treze fotos de serviços. As 62 identidades do registry coincidiam com o manifesto; associações, titularidade, limites e arquivos estavam corretos. As 124 URLs main/thumbnail responderam 200 e seus tamanhos/dimensões/WebP coincidiram com os metadados. Não havia órfãos nem reservas de upload pendentes. `smartbarber-dev` não tinha mídias.

A entrega original era parcial em relação ao acervo completo: 48 fotos não estavam publicadas. O índice HTML mantinha as vinte decisões anteriores, e algumas notas editoriais antigas contradiziam a nova associação. O commit não trouxe relatório agregado, recibo de segundo apply sem duplicação ou prova dos backups/validações privadas do executor. Isso não prova que esses arquivos não existam na máquina dele; apenas não foram recebidos nesta auditoria. `publicationApproved=false` no manifesto não foi tratado como prova de falha, pois o runner originalmente usa aprovação por SHA em arquivo separado.

## Autorização posterior e execução

O responsável autorizou publicar todas as mídias fornecidas para demonstração, dispensando as reservas editoriais anteriores. As fontes e créditos foram preservados; essa autorização não é apresentada como comprovação independente de direitos de terceiros. O conteúdo está em URLs públicas R2, como o acervo anterior.

As 37 fotos sem correspondência exata com o catálogo foram associadas ao portfólio geral das suas barbearias, sem inventar serviços, valores, duração ou identidade de funcionários. Dez fotos com identificação de terceiros foram liberadas pelo responsável para a demonstração. A foto complementar do Nexo fornecida pelo usuário foi recuperada, otimizada em WebP e incluída. Não houve geração de imagem nova.

A execução usou contas legítimas de proprietário criadas no reset e os endpoints existentes da API: sessão, upload-intent, PUT assinado R2, confirm/processamento e associações. As credenciais permaneceram na área privada local; nenhum segredo R2 do Álvaro foi copiado. O único registro administrativo de importação gravado diretamente no banco foi o ledger de identidades em `demo_seed_registry`, nunca uma mídia artificialmente marcada READY.

Resultado em **smartbarber-dev-2**:

| Item | Quantidade |
|---|---:|
| Mídias READY | 110 |
| Logos | 10 |
| Fotos de galeria/portfólio | 87 |
| Fotos associadas a serviços específicos | 13 |
| Reutilizadas da entrega anterior | 62 |
| Novas enviadas e associadas | 48 |
| Objetos públicos main + thumbnail verificados | 220 |
| Falhas HTTP, formato ou dimensão | 0 |
| Mídias órfãs / reservas de upload pendentes | 0 / 0 |
| Bytes main + thumbnail medidos | 7.816.606 |

O staging foi conferido vazio após a limpeza normal da API. A medição acima é do lote, não de todo o bucket/conta compartilhada: a credencial R2 local não permite listar o bucket público. Os objetos públicos foram conferidos por suas URLs e por decodificação dos arquivos. Não se declara medição global de faturamento/quota.

| Barbearia | Logos | Galeria/portfólio | Fotos de serviços | Total |
|---|---:|---:|---:|---:|
| Horizonte | 1 | 8 | 2 | 11 |
| Estação | 1 | 10 | 0 | 11 |
| Santana | 1 | 10 | 0 | 11 |
| Santo Amaro | 1 | 9 | 1 | 11 |
| Pompeia | 1 | 7 | 3 | 11 |
| Aurora | 1 | 10 | 0 | 11 |
| Vértice | 1 | 7 | 3 | 11 |
| Raiz | 1 | 10 | 0 | 11 |
| Órbita | 1 | 7 | 3 | 11 |
| Nexo | 1 | 9 | 1 | 11 |

As 110 identidades esperadas foram conciliadas com 110 mídias e associações corretas, sem duplicatas. A reutilização foi comprovada operacionalmente para as 62 já existentes. Um segundo apply integral das 110 não foi executado nesta auditoria. Os fingerprints completos de users/bookings antes e depois da complementação coincidiram. Não houve novo reset ou mudança de senhas, contas, preços ou duração.

## Serviços no feed e correção de código

Também foi encontrado um defeito no controller de atualização de serviço: `isFeatured`, `featuredOrder` e `imageUrl` eram validados e extraídos, mas não repassados ao caso de uso. A API retornava sucesso sem efetivar a configuração de destaque. Por isso as treze fotos vinculadas não apareciam como serviços no Explorar.

Os sete serviços exatos com fotos foram configurados como destaque por manutenção administrativa restrita, conferindo proprietário ativo, unidade, serviço, mídia READY e associação existente em uma transação. Preços, títulos e duração foram preservados. Depois, o feed publicado respondeu 200 para dez barbearias com dez logos e treze fotos de serviços. O feed conserva seu limite existente de seis mídias por unidade (60 itens neste lote); isso não significa que as outras fotos não foram publicadas. Elas permanecem nas galerias/catálogos correspondentes.

O controller foi corrigido neste PR para encaminhar os campos já previstos no contrato e respeitar a restrição de imagem do caso de uso. Três testes de regressão cobrem persistência de destaque/ordem, rejeição de outro ator e proibição de trocar imagem por URL arbitrária. Essa correção de código ainda depende do fluxo de revisão/merge/deploy; a configuração de dados necessária ao feed já foi efetivada e validada.

## Artefatos, verificações e limites

- Manifesto e galeria HTML atualizados para 110 entradas, com histórico e autorização explícita. A aprovação por SHA está em `assets/demo-media/approval-demo.json` e não contém segredos.
- Verificador offline: 110 arquivos, 6.947.456 bytes de fontes WebP otimizadas, hashes/formatos/lojas/serviços válidos. TypeScript completo aprovado. Suite de mídia/Explorar: 15 arquivos, 77 testes aprovados. Guards offline do importador: quatro aprovados.
- Recibos operacionais privados: `D:\Smart_Barber_Entregas\publicacao-integral-20261103`. Auditoria independente: `D:\Smart_Barber_Entregas\auditoria-importacao-alvaro-20261103`. Não enviar journals, credenciais ou IDs pessoais no Git.
- `smartbarber-dev` continua sem réplica das mídias; esta execução publicou no banco efetivamente usado pelo app, `smartbarber-dev-2`. Não declarar os dois ambientes concluídos.
- Não houve upload de vídeos porque não há arquivos de vídeo neste acervo. Não houve teste físico de iPhone.

## Selo visual do frontend

Em tarefa separada, o selo “Demonstração” do topo do Explorar foi removido no PR #55 do frontend. Os três testes existentes do componente passaram e os três checks do PR ficaram verdes. O responsável autorizou publicação, mas o GitHub bloqueou o merge por `REVIEW_REQUIRED`; o repositório também não permite auto-merge. Não foi usado bypass administrativo ou deploy paralelo para contornar a revisão. A remoção ainda não está na produção até essa exigência ser atendida.
