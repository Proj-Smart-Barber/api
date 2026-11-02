# Explorar, fotos de serviços e vídeos

## Comportamento

O feed usa ranking de proximidade e reputação publicada no PostgreSQL antes da paginação. Snapshots de IDs ordenados duram quinze minutos e são compartilhados entre instâncias. Cada página revalida as lojas e projeta somente um lote limitado de mídia. O contrato antigo de descoberta mantém sua ordenação.

As fotos de serviços são associadas por `service_media`, sem IDs sintéticos ou preços deduzidos da fotografia. A associação exige OWNER ativo, unidade correta e mídia READY. Cada serviço aceita até seis mídias, com ordem e capa. As fotografias ambientais conservam seu contexto e não recebem nome ou preço de serviço. Sem mídia válida, o app apresenta fallback; uma URL legada não se torna automaticamente mídia publicável.

Vídeos são enviados ao staging e processados por worker separado. O original pode ter até 100 MiB e 60 segundos, sujeito ao saldo reservado. A saída é MP4 H.264/AAC de até 720p e 20 MiB, com poster. Validação de contêiner, duração, dimensões, timeout, argumentos sem shell e limites de alocação protegem o processamento. Vídeos acima de 10 MiB podem usar partes de 5 MiB, sessões persistidas, verificação das partes pelo servidor e retomada. Cancelamento e limpeza abortam multipart incompleto.

## Configuração e rollout

Preservar as variáveis existentes `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_STAGING_BUCKET`, `STORAGE_PUBLIC_BUCKET` e `STORAGE_PUBLIC_URL`. Staging e público precisam ser buckets distintos. Não imprimir valores nem copiar credenciais entre projetos.

- `R2_GLOBAL_BUDGET_BYTES`: teto de bytes da aplicação. Na ausência da variável, o limite inicial conservador é 1.000.000.000 bytes.
- `R2_SHOP_BUDGET_BYTES`: teto de bytes por unidade/escopo. Padrão inicial: 100.000.000 bytes.
- Novas intenções são bloqueadas acima de 90% do teto, contando armazenamento e reservas concorrentes. A reserva inclui original temporário e derivados. A quota não conhece automaticamente objetos de outros projetos ou órfãos não registrados no banco: conferir ocupação real da conta antes de ampliar os limites.
- `MEDIA_VIDEO_ENABLED`: permanece `false` por padrão. Ativar somente depois de provisionar o worker e validar o upload real, o processamento e o orçamento no ambiente de destino.
- `SYSTEM_MAINTENANCE_SECRET`: segredo de manutenção com pelo menos 32 caracteres; sem ele, `/api/system/*` fica indisponível. Quando configurado, usar o header `x-maintenance-key`. Uma frase pública de confirmação não autoriza execução de seed/migration por HTTP.

O bootstrap aguarda o resultado das migrations antes de atender requisições. As migrations são aditivas. Não executar seed em produção para publicar o código. O worker não deve ser iniciado como processo de longa duração dentro de uma função Vercel comum.

Iniciar o worker em ambiente apropriado com as mesmas configurações de banco/storage:

```powershell
npm run media:video:worker
# Uma iteração para diagnóstico controlado:
npm run media:video:worker -- --once
```

Configurar limpeza periódica pelo mecanismo interno autenticado existente. Reservas só devem ser liberadas depois da limpeza confirmada. O envio de originais, derivados, multipart e requisições gera consumo; limites de bytes não substituem acompanhamento das operações do provedor.

## Contratos adicionados

- `GET|POST /api/barbershops/explore-feed`: leitura do feed. Preferir POST para não colocar coordenadas em query string.
- `POST /api/barbershops/:shopId/services/:serviceId/media`: associação/reordenação de mídia READY; body `mediaId` e `displayOrder`.
- `GET /api/barbershops/:shopId/services/:serviceId/media`: lista as mídias públicas do serviço. Owner ativo também pode consultar serviço inativo.
- `DELETE /api/barbershops/:shopId/services/:serviceId/media/:mediaId`: remove o vínculo e mantém objetos ainda referenciados.
- `POST /api/media/:mediaId/upload-url`: reemite URL curta para intenção pendente autorizada.
- `POST /api/media/:mediaId/multipart`, `/multipart/part`, `/multipart/complete`: iniciam/retomam sessão, autorizam parte e concluem após verificação no storage.
- `DELETE /api/media/:mediaId`: cancela mídia não associada e aborta multipart quando aplicável.

Novas finalidades: `SERVICE_PHOTO`, `SERVICE_VIDEO` e `BARBERSHOP_VIDEO`. Fotos de logo e ambiente continuam usando as finalidades existentes. URLs livres não substituem upload no cadastro do serviço: salvar primeiro o serviço, depois enviar/associar suas mídias. A leitura de registros legados continua compatível; o feed exige projeção de mídia validada.

## Seed e acervo

O motor canônico foi preservado em `src/infra/drizzle/demo-seed/canonical`, mantendo dez marcas, 62 serviços e os predicados de desativação restrita. O arquivo legado `src/infra/drizzle/seed.ts` não executa mais sua mutação direta. `npm run db:seed` agora é dry-run. Os fluxos canônicos de apply e rollback continuam exigindo a validação do ambiente e a autorização operacional apropriada. Não usar seed para inserir fotografias nem para corrigir agregados de avaliações artificialmente.

```powershell
npm run media:prepare
npm run media:import
# O importador é dry-run por padrão.
```

`scripts/prepare-demo-media.ts` preserva os originais, verifica hashes e prepara derivados. `scripts/import-demo-media.ts` só importa vínculos com unidade/serviço resolvidos e aprovação explícita no manifesto, usando o pipeline autenticado do owner. Registra lote, mídia e associação para evitar duplicação. `scripts/rollback-demo-media.ts` remove apenas vínculos do lote, preservando conteúdo utilizado por terceiros e alterações posteriores. O importador limita a aplicação à API de homologação local e só aceita URLs de PUT do domínio S3 R2. Não converter esse comando em importação de produção por troca silenciosa de URL.

Os arquivos preparados, relatórios com IDs do banco de ensaio e fixtures de vídeo são artefatos locais; não fazem parte do deployment. A referência `docs/seed-media/manifesto-10-barbearias.json` é editorial e não declara direitos ou associações já aprovados. USER-NEXO-003 continua excluído por procedência desconhecida.

## Verificação

```powershell
npx tsc --noEmit
npm run test:explore:media
```

A suíte específica não carrega dotenv nem inicializa banco/storage: cobre ranking, cursor, projeção, serviços, mídia, fixtures canônicas e adaptador R2 com fakes. Integração PostgreSQL e transcodificação real foram verificadas separadamente em banco descartável, sem migration/seed no banco publicado. Teste com fake de storage não comprova PUT no R2 nem funcionamento em celular.

Para concluir a homologação: testar uma imagem pequena como owner, confirmar os bytes no storage, o estado READY, a associação, a reabertura do app e a remoção. Depois testar vídeo, partes, queda de rede, poster, player e pausa ao sair da tela. Repetir em iPhone e Android físicos, nos dois temas. Não declarar homologação completa apenas com build ou testes de componentes.
