# Google Maps em produção — execução do Álvaro

## Destino confirmado

A API publicada em `https://api-black-theta-13.vercel.app` respondeu com servidor Vercel. O deployment Production da main `56011e4` e seu status GitHub apontam para o projeto `api` na conta Vercel do Álvaro. Não usar o projeto do frontend para os segredos do servidor.

Pré-requisito: publicar esta alteração de configuração. Ela adiciona cron diário e roteiro de verificação, sem migrations, seeds, novos endpoints ou dependências.

## O que inserir na Vercel da API

Em **Settings → Environment Variables**, ambiente **Production**:

| Nome exato | Valor |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | Chave restrita à Geocoding API, fornecida pelo responsável |
| `CRON_SECRET` | Segredo aleatório forte, exclusivo para manutenção; usar pelo menos 32 caracteres |

Não cadastrar as chaves web/Android/iOS no backend. Elas pertencem aos builds clientes. Não colocar nenhum valor em Git, issue, chat ou screenshots.

O código já aceita `GOOGLE_GEOCODING_API_KEY` como alternativa, mas `GOOGLE_MAPS_API_KEY` tem precedência inclusive quando vazia. Usar o nome principal acima evita ambiguidade; não configurar a principal vazia com a alternativa preenchida.

Depois de salvar, fazer **Redeploy** para aplicar as variáveis ao processo. Não executar `/api/system/migrate` nem seeds para configurar Google Maps.

## Manutenção automática

O `vercel.json` agenda `GET /api/internal/locations/refresh` diariamente às **06:00 UTC / 03:00 de São Paulo**, expressão `0 6 * * *`. A Vercel envia `Authorization: Bearer <CRON_SECRET>` automaticamente. A rota já exige esse segredo e falha com 401 quando ausente/incorreto.

A manutenção limpa candidatos/buckets expirados, invalida localizações Google vencidas e atualiza o heartbeat. Proximidade falha com 503 quando esse heartbeat fica ausente, não saudável ou ultrapassa o limite de 36 horas. Por isso, executar a manutenção uma vez após o primeiro deploy e confirmar o cron em **Settings → Cron Jobs**. Não desativar a autenticação e não colocar segredo na URL.

O job diário é compatível com a frequência diária do plano Hobby; sua execução pode ter atraso. Conferir logs e heartbeat caso haja 503. Não criar serviço pago ou alterar plano sem autorização.

## Teste automático pronto

Requer Node.js 22 e o checkout atualizado; não requer `npm install`, banco local, chave Google no computador nem suíte completa da API.

1. Executar somente verificações anônimas:

   ```powershell
   $env:GOOGLE_TEST_API_URL='https://api-black-theta-13.vercel.app'
   node scripts/verify-google-maps.mjs
   ```

2. Criar **localmente** `.env.google-test.local`, já ignorado por `.gitignore`, com os nomes abaixo. Preencher valores em editor local/gestor de segredos, sem colá-los no terminal, issue ou chat:

   ```dotenv
   GOOGLE_TEST_API_URL=https://api-black-theta-13.vercel.app
   GOOGLE_TEST_OWNER_TOKEN=
   GOOGLE_TEST_SHOP_ID=
   CRON_SECRET=
   ```

   `GOOGLE_TEST_OWNER_TOKEN` é um access token temporário obtido no login normal de um OWNER verificado com vínculo ativo. `GOOGLE_TEST_SHOP_ID` é o UUID de uma unidade de teste desse proprietário. Esses dois valores são parâmetros locais de teste, **não** variáveis permanentes da hospedagem. Não usar refresh token como access token.

3. Com autorização para a manutenção e a consulta de teste, executar:

   ```powershell
   node --env-file=.env.google-test.local scripts/verify-google-maps.mjs --refresh --geocode
   ```

   Os flags executam manutenção e uma consulta Google para um endereço público de teste. A consulta consome quota e cria um candidato temporário; não confirma nem altera endereço/ponto de uma barbearia. O script testa os raios 5/10/25/50 km, sem imprimir credenciais ou coordenadas. Não repetir em loop. Excluir o token temporário do arquivo ao terminar.

Resultado esperado: nove checks PASS, geocoding PASS e maintenance PASS, exit 0. GPS e interface de mapa permanecem explicitamente NOT TESTED nesse script.

## Teste de interface após o backend

- OWNER ativo abre Configurações, pesquisa endereço de uma unidade de teste e confirma o ponto Google. Conferir sucesso, versão e ausência de conflito.
- Cliente abre o site com a chave web já publicada, concede localização voluntariamente e testa os raios e “Ver no mapa”. Confirmar mapa Google real e navegação ao catálogo.
- Permissão negada/timeout mantém busca textual; não considerar mapa de contingência como Google Maps homologado.
- Não registrar coordenadas pessoais em evidências. Não substituir endereço de unidade real apenas para testar.
- Android/iOS requerem builds próprios com suas chaves e assinaturas; inserir a chave da API não configura os SDKs nativos.

## Falhas comuns

| Resultado | Conferir |
| --- | --- |
| 401 em geocodificação autenticada | Token de acesso expirado/incorreto; renovar pelo login |
| 403 na busca de endereço | OWNER verificado, vínculo e unidade ativos |
| 401 em manutenção autorizada | `CRON_SECRET` igual no teste e no deployment atualizado |
| 429 | Quota local/provedor; respeitar Retry-After e não insistir em loop |
| 503 em geocodificação | Chave aplicada no redeploy, Geocoding API/faturamento e restrições de IP compatíveis |
| 503 em proximidade | Manutenção/heartbeat e cron habilitado |
| Mapa web não carrega | Chave web no build do frontend, Maps JavaScript API e referrer; isso não usa a chave secreta da API |

Referências: [Cron autenticado da Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs), [limites do cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [restrições Google](https://developers.google.com/maps/api-security-best-practices).
