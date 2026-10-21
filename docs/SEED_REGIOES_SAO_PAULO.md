# Seed de demonstração — cinco regiões da cidade de São Paulo

O seed de demonstração passa a cobrir Centro, Norte, Sul, Leste e Oeste do **município** de São Paulo. As unidades continuam fictícias e identificadas por “Demonstração”. Os endereços e pontos abaixo são referências públicas para testes; os locais de referência não são barbearias, parceiros ou estabelecimentos cadastrados pelo seed.

| Unidade de demonstração | Região | Endereço de referência |
| --- | --- | --- |
| Horizonte | Centro | Rua 24 de Maio, 109 - República, São Paulo - SP, 01041-001 |
| Estação | Leste | Rua Visconde de Parnaíba, 1316 - Mooca, São Paulo - SP, 03164-300 |
| Santana | Norte | Avenida Luiz Dumont Villares, 579 - Santana, São Paulo - SP, 02085-100 |
| Santo Amaro | Sul | Rua Amador Bueno, 505 - Santo Amaro, São Paulo - SP, 04752-005 |
| Pompeia | Oeste | Rua Clélia, 93 - Pompeia, São Paulo - SP, 05042-000 |

## Fontes e coordenadas

Endereços verificados em fontes institucionais em 21/10/2026:

- [Sesc 24 de Maio](https://portal.sescsp.org.br/unidades/36_24%2BDE%2BMAIO/).
- [Museu da Imigração](https://museudaimigracao.org.br/), [relatório institucional com CEP](https://www.museudaimigracao.org.br/uploads/portal/gestao/transparencia/arquivos/relatorio-de-gestao-2022-30-08-2024-13-05.pdf).
- [Sesc Santana](https://www.sescsp.org.br/editorial/servicos-santana/), [endereço/CEP divulgado pela Prefeitura](https://prefeitura.sp.gov.br/web/cultura/w/tit%C3%A3s-sidney-magal-e-polenta-gr%C3%A1tis-virada-cultural-2026-traz-m%C3%BAsica-cinema-e-espet%C3%A1culos-teatrais-gratuitos-para-zona-norte).
- [Sesc Santo Amaro](https://www.sescsp.org.br/unidades/santo-amaro/servicos), [localização das unidades](https://portal.sescsp.org.br/files/transparencia/Realizacoes2021-7051971653489.pdf).
- [Sesc Pompeia](https://anexa.sescsp.org.br/contato/).

Coordenadas de referência obtidas no Wikidata (CC0), não no Google: [Centro Q55154350](https://www.wikidata.org/wiki/Q55154350), [Leste Q3854482](https://www.wikidata.org/wiki/Q3854482), [Norte Q10366512](https://www.wikidata.org/wiki/Q10366512), [Sul Q28680384](https://www.wikidata.org/wiki/Q28680384), [Oeste Q645190](https://www.wikidata.org/wiki/Q645190). Valores e fontes estão versionados em `regional-locations.ts`; o seed não consulta geocodificadores externos.

Os pontos são referências dos equipamentos públicos, não comprovação da entrada física de uma barbearia real. Para dados reais, o proprietário deve pesquisar e confirmar seu próprio endereço/pino pelo fluxo Google Maps do produto.

## Comportamento ao aplicar

- Mantém as chaves lógicas e identidades das duas unidades originais e das oito contas de equipe.
- Adiciona três unidades, seis serviços ativos e jornadas para seus proprietários; cria os vínculos adicionais sem duplicar contas. O total planejado é cinco unidades, 11 vínculos e 20 serviços.
- Registra pontos demonstrativos como `CONFIRMED` / `MANUAL`, sem Place ID, referência ou cache Google. A procedência é o dado público CC0 registrado na fixture.
- Reconcilia endereço/ponto em transação somente quando unidade, proprietário e registro de namespace correspondem à fixture esperada. Pontos sem procedência no registry ou alterados por um proprietário são preservados.
- Reaplicar não duplica IDs nem incrementa a versão de geografia que já corresponde à fixture. Endereço e ponto fazem rollback juntos quando a gravação no registry falha.
- O dry-run informa cinco localizações planejadas sem criar registros ou chamar serviços externos.
- Não cria heartbeat artificial nem desativa o controle de saúde da descoberta. A manutenção de localizações continua necessária para o endpoint de proximidade ficar saudável.

## Operação

O comando relacionado a esta entrega é `npm run db:seed:demo:dry-run` / `npm run db:seed:demo:apply`, com o destino DATABASE_URL explicitamente conferido. O seed legado `npm run db:seed` apaga registros globalmente e não é o fluxo atualizado nesta entrega.

Não executar apply/rollback/migrations em produção apenas para testar o código. A atualização deste seed não altera os registros já publicados até uma execução autorizada. Os quatro cadastros públicos fora do namespace de demonstração não devem ser corrigidos automaticamente por esse seed.

Para testar proximidade após uma execução autorizada, executar a manutenção real protegida e consultar `/api/barbershops/nearby` perto de cada referência, nos raios suportados. O seed fornece os pontos de demonstração; Google Maps e GPS físico exigem homologação própria.

## Verificação desta alteração

Suítes focadas de integridade e geografia cobrem cinco regiões, continuidade de contas/IDs, dry-run, criação, reaplicação, descoberta real em PostgreSQL, preservação de alteração do proprietário, recusa de registros externos/outro proprietário, concorrência e rollback. Os testes PostgreSQL são opt-in com `PHASE1_TEST_DATABASE_URL` e usam banco descartável de loopback criado pelo helper; não executar a suíte inteira contra DATABASE_URL herdada.
