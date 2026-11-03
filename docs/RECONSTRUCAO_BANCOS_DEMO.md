# Reconstrução completa dos dois bancos conforme o seed

## Autorização e alvo

Em 03/11/2026, o responsável solicitou substituir todos os dados de produção pelos dados do seed, incluindo contas e senhas. Após aviso de que isso apaga contas, senhas, reservas, sessões e associações de mídia, confirmou explicitamente: **os dois bancos**, `smartbarber-dev` e `smartbarber-dev-2`. O principal escolhido para a API foi `smartbarber-dev`.

Essa autorização permite a reconstrução desses dois alvos, não outros bancos. A conexão efetivamente usada pela API publicada ainda precisa ser confirmada pelo operador com acesso à Vercel. Não inferir produção pelo nome de um banco, por uma URL pública ou pelo nome do projeto local.

## Situação encontrada

O seed aplicado em 02/11/2026 reutilizou os 12 clientes e preservou suas senhas. Não foi uma limpeza completa. Os recibos dessa aplicação não comprovam o estado atual nem substituem um backup recente.

O comando canônico atual preserva identidades já registradas. Reexecutar `db:seed:demo:apply` sobre os bancos existentes NÃO atende ao novo pedido. O rollback do namespace também não limpa registros externos ao seed. Não usar o seed legado, SQL destrutivo improvisado ou uma sequência independente de limpeza e seed sem restauração/atomicidade garantidas.

## Plano obrigatório para a IA executora

1. Confirmar por ambiente Production do projeto existente na Vercel o host/nome do banco servido pela API. Obter as conexões atuais de ambos os alvos por canal seguro, sem copiar credenciais antigas expostas no chat. Se o alvo da API divergir desses dois nomes, parar a escrita e informar a divergência.
2. Fazer inventário agregado e backup custom recente de CADA banco. Guardar também referências anteriores de mídia/R2, configurações de schema e contagens. Verificar o arquivo com `pg_restore --list` e restaurar cada backup em banco isolado. Não publicar dados pessoais, hashes de senha, senhas, DSNs, tokens ou URLs assinadas.
3. Preparar e testar uma reconstrução controlada, separada do seed incremental. Preferir banco de substituição isolado com schema atual e seed novo, validado antes do corte, com reversão imediata da conexão. Se for necessário manter o mesmo banco/host, implementar reset e seed em uma única transação usando o mesmo client/transaction em TODOS os acessos do engine e registry; não fingir atomicidade envolvendo operações que usam outra conexão global.
4. Não criar banco novo nem trocar DATABASE_URL silenciosamente: documentar a estratégia, provar o destino e preservar a conexão anterior para rollback. A autorização de reconstrução cobre os dois bancos informados; não autoriza apagar outros bancos, buckets, schema de extensões, funções do provedor ou tabelas de migração sem análise.
5. No ensaio isolado, reproduzir os dados atuais restaurados e demonstrar que o estado final corresponde ao catálogo canônico: 10 barbearias, 16 profissionais, 12 clientes, 62 serviços, 24 vínculos, 145 jornadas e 20 reservas. Conferir também exceções, carrinhos e itens de reserva conforme fixtures; não duplicar tabelas/contas legadas. Datas das reservas devem usar a data-base atual do seed.
6. Credenciais: partir de um arquivo de credenciais NOVO em diretório privado para não reutilizar senhas antigas. Profissionais usam geração segura individual do seed; clientes usam a política definida no seed. Validar bcrypt por comparação com a senha correspondente, verificação de e-mail e perfil CLIENT/OWNER/BARBER adequado. Não alterar o algoritmo do produto nem fixar senha pública para proprietários.
7. O cliente principal do catálogo canônico desta branch é Lucas Andrade, `cliente@smartbarber.com`. O endereço legado `lucas.andrade.demo@example.com` não é o login final pretendido para um banco novo. A senha padrão definida no código só deve ser apresentada como válida depois de comprovada no banco novo e na API publicada.
8. Antes do corte/commit destrutivo, controlar tráfego e trabalhos agendados para evitar escrita concorrente, confirmar backups e alvos exatos e ter rollback ensaiado. Executar serialmente por banco; registrar qualquer sucesso parcial. Não limpar primeiro os dois bancos e deixar a recriação para depois.
9. Sessões antigas e tokens persistidos devem ser revogados/removidos no estado novo. Se JWTs anteriores puderem continuar válidos por reutilização de IDs, aplicar a estratégia de versão de credencial/revogação suportada pelo produto; não invalidar outros ambientes por compartilhar segredos.
10. Verificar logins reais de cliente e proprietário pela API publicada após confirmar sua conexão. Revogar as sessões criadas pelo teste. Entregar as credenciais finais somente ao responsável, por canal privado, e nunca no Git ou relatório público. Não declarar login válido com base apenas no arquivo de fixture.
11. Só então executar a importação de mídias conforme `PLANO_IMPORTACAO_MIDIAS_DEMO.md`, resolvendo os novos IDs pelo registry. Não reutilizar IDs de recibos anteriores. Inventariar objetos antigos no R2; não apagar buckets/objetos compartilhados ou executar limpeza ampla. Manter objetos anteriores durante a janela de rollback e medir seu consumo real.
12. Entregar relatório por banco com estratégia, backup/restauração, contagens, senhas verificadas sem valores, sessões, API publicada, idempotência e importação de mídia. Se faltar acesso atual, ambiente, estratégia ensaiada ou confirmação de alvo, marcar BLOCKED e não executar exclusões.

## Limite desta preparação

Esta atualização documenta a nova autorização e altera o prompt do executor. Não constitui prova de reset executado. O acesso remoto da execução anterior não está mais carregado nesta máquina; os arquivos `.env` encontrados apontam apenas para bancos locais. Em orientação posterior de 03/11/2026, o responsável determinou executar esta tarefa diretamente na máquina do Wellington, com conexões PostgreSQL atuais fornecidas localmente. Não é necessário acessar a Vercel para executar SQL/seed. O ambiente publicado continua relevante para confirmar qual banco atende o app, mas não bloqueia a conexão direta aos dois alvos explicitamente autorizados. A tarefa do Álvaro fica restrita à importação das mídias depois da reconstrução local.
