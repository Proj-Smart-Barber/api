# Importação administrativa do acervo Smart Barber

## Atualização de escopo e execução em 03/11/2026

O responsável autorizou publicar integralmente as mídias fornecidas para demonstração, dispensando a reserva editorial anterior. O manifesto atual contém 110 arquivos: dez logos, 87 fotos de portfólio/galeria e treze fotos vinculadas a serviços exatos. As 37 fotos antes sem correspondência de serviço foram incorporadas ao portfólio geral, sem inventar serviço, preço ou duração; dez fotos com marcas visíveis e a foto complementar do Nexo também foram autorizadas. Créditos e histórico foram preservados. A autorização por SHA está em assets/demo-media/approval-demo.json e não contém credenciais.

A publicação integral no banco efetivamente servido pela API (smartbarber-dev-2) foi concluída. Foram reutilizadas as 62 mídias publicadas pelo executor anterior e enviadas somente 48 novas, por sessões legítimas dos proprietários demonstrativos e endpoints normais de upload/confirm/associação. Nenhuma mídia foi inserida READY por SQL. O segundo banco smartbarber-dev ainda não recebeu réplica das mídias. Relatório: PUBLICACAO_INTEGRAL_2026-11-03.md.

As contagens e reservas descritas nas seções seguintes são o planejamento inicial, mantido como histórico. A autorização e o manifesto atuais prevalecem sobre as restrições editoriais anteriores. Não executar reset nem duplicar a publicação concluída. O R2 público continua acessível pelas URLs; demonstração não implica acesso privado.

## Entrega e objetivo

Importar o acervo fornecido para as dez barbearias sem criar outro backend, alterar URLs ou solicitar senhas de dez proprietários. O operador autorizado executa um comando local com o ambiente do backend existente. Não há endpoint administrativo novo nem alteração da autenticação pública.

O comando usa o acesso administrativo ao banco para resolver as unidades e seus proprietários ativos, e chama os controllers existentes de iniciar upload, confirmar/processar, atualizar logo, adicionar galeria e associar serviço. As verificações de proprietário, escopo, decodificação Sharp, geração de variantes, leases e quota continuam na lógica atual da API.

## Acervo portável

`assets/demo-media/manifest.json` contém 110 entradas: 109 WebP locais (6.822.894 bytes) e uma exclusão por origem desconhecida. Não contém IDs de banco, credenciais, imagens remotas necessárias em tempo de execução ou caminhos absolutos da máquina anterior. `index.html` permite revisão visual local.

Há 66 candidatas selecionadas (10 logos, 49 fotos de espaço/equipe ilustrativa e 7 fotos com serviço confirmado), 43 fotos de serviço em reserva e uma exclusão. Todas as aprovações editoriais continuam pendentes. A IA executora deve observar as imagens e preservar as fontes/créditos. Reserva não equivale a falha de upload: ela evita vincular uma fotografia ao serviço errado. Não inventar serviço, preço, funcionário ou instalações reais para usar uma imagem.

O usuário autorizou o uso do acervo fornecido para demonstração. Isso não constitui comprovação de direitos de terceiros. Onde a origem ou relevância não estiver comprovada, manter a pendência e explicar o motivo. Os créditos e observações anteriores estão no manifesto.

## Execução

1. Usar um worktree limpo desta branch no repositório da API. Preservar trabalho existente.
2. Usar o projeto Vercel existente do Álvaro e obter seu ambiente Production por CLI em `.env.media-import.local`, nunca no chat ou Git. Confirmar projeto/equipe antes de puxar variáveis.
3. O alvo principal aprovado é `smartbarber-dev`. Os dois bancos informados foram autorizados anteriormente para população, mas cada execução exige ambiente e backup próprios. Se o ambiente do backend apontar para outro banco, interromper antes de escrever e resolver a divergência com o responsável. Não sobrescrever DATABASE_URL na Vercel.
4. Conferir `STORAGE_STAGING_BUCKET=smartbarber`, `STORAGE_PUBLIC_BUCKET=smartbarber-public`, endpoint R2 e domínio público. A referência documentada é `https://midia-smartbarber.wellingtonsp.uk`; confirmar configuração efetiva. Precisam de credenciais com acesso aos dois buckets. Não usar o token local limitado só a staging.
5. Executar a verificação offline do pacote, a checagem TypeScript e os guards abaixo. Não executar a suíte geral que carrega dotenv/banco.
6. Revisar `index.html`, fontes e `reserve`. Manter as reservas incompatíveis. Se houver associação adicional comprovável, atualizar `serviceKey` e `decision` com evidência visual e conferir o serviço no catálogo/banco. Não criar serviços para encaixar fotos. Manter `publicationApproved=false` como histórico; a autorização de execução é o arquivo separado de aprovação.
7. Gerar `.media-import/approval.json` com `{"approvedSha256":["hash de cada imagem efetivamente revisada e autorizada"]}`. Não gerar a lista por aprovação cega de todos os arquivos.
8. Criar backup PostgreSQL custom (`pg_dump --format=custom`) do alvo exato e verificar com `pg_restore --list`. Segredos só por ambiente/processo, nunca no argumento DSN ou saída. Guardar fora do repo, acesso restrito ao operador. O script confere o formato PGDMP, mas a origem/restaurabilidade do backup é responsabilidade do operador.
9. Rodar dry-run, analisar os bloqueios e então apply. Se já houver logo, revisar o valor anterior. Só usar `--replace-logos` para substituir logos legados da demonstração conforme autorizado; preservar alterações externas.
10. Repetir a execução: `plannedNew=0`, `imported=0`, `reused` igual ao total associado. Conferir URLs públicas, variantes e associações. Cada item publicado já recebe inspeção R2 e HEAD público pelo runner.

```powershell
npm ci # somente se necessário; preservar dependências saudáveis
node node_modules/tsx/dist/cli.mjs scripts/verify-demo-media-package.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.media-import.json
node scripts/test-demo-media-guards.cjs

# Após vercel link no projeto/equipe corretos (sem deploy):
vercel env pull .env.media-import.local --environment=production

# Substituir HOST pelo host conferido do banco, sem usuário/senha.
node node_modules/tsx/dist/cli.mjs scripts/admin-import-demo-media.ts --env-file=.env.media-import.local --expected-host=HOST --expected-database=smartbarber-dev

node node_modules/tsx/dist/cli.mjs scripts/admin-import-demo-media.ts --env-file=.env.media-import.local --expected-host=HOST --expected-database=smartbarber-dev --approval-file=.media-import/approval.json --backup=CAMINHO_DO_BACKUP.dump --apply --confirm=IMPORTAR_MIDIAS_DEMO
```

## Segurança, retomada e limites

- Sem migrations, seed, alterações em contas, exclusões globais, novo deploy ou troca de domínio. Backup não autoriza restauração global sobre dados concorrentes.
- Apenas dez chaves lógicas permitidas, namespace de seed exato, proprietário ativo e serviço ativo da mesma unidade. SHA, tamanho, caminho real dentro do pacote e formato WebP de todas as selecionadas são conferidos antes da escrita.
- Dry-run não escreve no banco/R2. Faz consultas e verifica acesso de leitura aos dois buckets, catálogo, capacidades e orçamento conservador. Gera recibo local.
- Apply usa aprovação explícita por SHA, confirmação e backup. Processamento serial, lock PostgreSQL entre runners, limite de dez fotos de galeria e seis por serviço, além dos guards/quota do produto. Quotas do produto cobrem este banco; o operador deve medir uso externo total dos buckets/conta antes da execução e configurar orçamento real. Não confundir quota de um banco com limite global da conta compartilhada.
- A identidade persistida está em `demo_seed_registry`, namespace separado `demo-media-import-v1`, vinculando cada hash/loja/serviço/finalidade ao mediaId. `.media-import/<alvo>/journal.json` registra progresso e logo anterior, sem credenciais. Não apagar esses recibos.
- Uma queda entre criar intent e persistir o journal pode deixar uma mídia PENDING sem registro de importação. Parar e conciliar pelo proprietário/horário/hash antes de retomar; não apagar mídias alheias nem gerar intents ilimitadamente. Estado PROCESSING com lease ativo deve aguardar; estados REJECTED/CANCELLED/EXPIRED exigem análise, não recriação silenciosa.
- O importador não inventa aprovação editorial, não publica a imagem de origem desconhecida e não faz rollback global. Para desfazer, usar os fluxos autenticados de desassociação/remoção somente dos mediaIds deste lote; revisar logos anteriores no journal. Cleanup normal confirma remoção do storage. Não apagar diretamente objetos compartilhados entre bancos.
- Vídeos não fazem parte deste acervo: não há arquivos de vídeo recebidos. Não declarar teste nem upload de vídeo concluído.

## Critério de entrega do executor

Relatório agregado por banco/barbearia: candidatas, aprovadas, publicadas, reutilizadas, reservas e exclusões; bytes finais main+thumbnail; status READY; relações em galeria/serviço/logo; disponibilidade pública; quota; teste de retomada e diferença zero de usuários/reservas anteriores. Redigir falhas como PASS/PARTIAL/BLOCKED e não afirmar 109 publicações se 43 continuarem em reserva. Guardar evidência privada sem tokens, DSNs, URLs assinadas ou linhas pessoais.
