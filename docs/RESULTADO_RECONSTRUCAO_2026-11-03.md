# Reconstrução dos dois bancos de demonstração

## Resultado efetivo

Executado em 03/11/2026 por conexão PostgreSQL direta, com as URLs atuais fornecidas localmente em arquivos DPAPI. O responsável autorizou a limpeza completa de `smartbarber-dev` e `smartbarber-dev-2`, incluindo contas, senhas, reservas, sessões e associações. Não houve troca de backend, URL, conexão Vercel ou exclusão de objetos R2.

| Banco | Usuários antes | Barbearias antes | Usuários finais | Barbearias finais | Serviços | Reservas |
|---|---:|---:|---:|---:|---:|---:|
| smartbarber-dev | 29 | 10 | 28 | 10 | 62 | 20 |
| smartbarber-dev-2 | 36 | 14 | 28 | 10 | 62 | 20 |

Cada banco final tem 16 profissionais, 12 clientes, 24 vínculos, 145 jornadas, 6 exceções, 20 itens/carrinhos legados, 20 snapshots modernos de serviços de reserva, 20 eventos CREATED e 375 vínculos no registry do seed. Mídias, sessões antigas e demais tabelas de dados fora das fixtures ficaram vazias. Nenhuma senha anterior foi reutilizada: clientes seguem a política canônica e profissionais receberam credenciais individuais novas. Os 28 perfis e hashes de senha foram conferidos em cada banco.

## Garantias e provas

- Backups custom recentes dos dois bancos, gerados sob snapshots PostgreSQL exportados e consistentes com fingerprints agregadas das 35 tabelas. Arquivos verificados e restaurados em PostgreSQL 17 isolado; todos os fingerprints das cópias coincidiram com os snapshots originais.
- Dois ensaios com falha forçada depois do seed: as transações reverteram todas as alterações e restauraram integralmente os dados anteriores. Depois, a execução completa sobre as duas cópias passou.
- Reset remoto em transação única, incluindo engine e registry, sem CASCADE. Tabelas externas à lista conhecida são recusadas. Locks de todas as tabelas impedem escrita concorrente durante a operação, e fingerprints são comparados com o backup antes do TRUNCATE. Qualquer divergência ou erro impede commit.
- Validação de contagens, nomes, e-mails, CPFs, papéis, verificação de e-mail, bcrypt, barbearias e serviços executada antes de cada COMMIT.
- Login real de cliente e proprietário confirmado na API publicada. Login de cliente pelo proxy do frontend também confirmado. A API atual foi identificada pelos IDs como conectada a **smartbarber-dev-2**, embora o banco principal desejado anteriormente tenha sido chamado de smartbarber-dev. Não houve reconfiguração silenciosa.
- As três sessões criadas pelos testes foram revogadas e seus registros removidos por hashes e usuários exatos. Verificação final: zero refresh_tokens e zero media nos dois bancos.
- TypeScript aprovado; 14 arquivos/74 testes offline de mídia/Explorar aprovados. Provas PostgreSQL são reais e separadas de provas de navegador/dispositivo, que não foram executadas.

## Alteração do seed

O engine e o registry agora aceitam uma conexão transacional injetada, mantendo o padrão anterior para o seed incremental. Também foi corrigida a criação de snapshots modernos e eventos das reservas em seeds novos; esses dados antes só estavam presentes por backfills históricos. O reset é um CLI separado e não adiciona endpoint público nem roda no deploy.

O comando `scripts/rebuild-demo-database.ts` é destrutivo. Exige alvo explícito, confirmação `ZERAR_E_RECRIAR_SEED`, diretório de credenciais novo e prova recente de backup consistente. O caminho de saída é restrito à área privada usada nesta operação Windows. Não usar esse comando como rotina de deploy ou em outro banco sem revisar seus guards e ensaiar novamente.

## Evidências privadas e próxima fase

Backups, fingerprints, relatórios, credenciais individuais e recibos estão em `D:\Smart_Barber_Entregas\seed-reset-20261103`, com ACL restrita ao usuário Windows. Credenciais e backups não pertencem ao Git. Os contêineres usados apenas no ensaio foram parados após a verificação, preservando seus dados para auditoria local.

A importação de mídias do pacote do PR #67 pode continuar após confirmar o banco efetivo. Deve resolver todos os IDs pelo registry novo; IDs e journals anteriores ao reset não servem como associação válida. Objetos R2 antigos não foram removidos e precisam entrar na medição de orçamento/rollback. Reservas editoriais e exclusões do acervo continuam pendentes conforme o manifesto. Esta execução não constitui prova de upload das imagens.
