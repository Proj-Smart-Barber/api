# Confirmação de cadastro por código

## Problema e comportamento final

A tela pedia código, mas a API gerava um token opaco e o e-mail trazia um link. A configuração antiga podia apontar para a landing, onde `/verify-email` retornava 404. A rota correta pertence a `https://app.smartbarber.wellingtonsp.uk/verify-email`.

Novos envios passam a usar um código aleatório de seis dígitos no corpo do e-mail, com validade de dez minutos. O frontend confirma por `POST /api/users/verification-email/confirm` com `{email,code}`. Zeros iniciais são preservados. A confirmação ativa a conta, mas não gera sessão nem altera seu papel; o usuário entra pelo login normal.

O e-mail novo não contém link de confirmação. Links opacos anteriores continuam aceitos por `{token}` durante sua validade. O builder corrige a origem antiga conhecida e a landing tem um handler de compatibilidade com destino fixo, preservando somente token/email, sem cache ou referência de origem. Um novo reenvio invalida os desafios anteriores.

## Proteções

- HMAC-SHA256 com segredo privado, domínio de propósito e userId, em vez de hash simples de um número de baixa entropia. `EMAIL_VERIFICATION_CODE_SECRET` é opcional (mínimo de 32 caracteres); sem ele, usa o JWT_SECRET privado atual. Nunca usar EXPO_PUBLIC_* para esse segredo. Uma mudança futura de e-mail deve invalidar desafios pendentes.
- Somente o hash é armazenado. Código e corpo do e-mail não são registrados nos logs. Não transportar códigos em query/GET, devolver código na API ou expor SQL/provedor em respostas de falha.
- Cinco erros por emissão; cooldown de 60 segundos e no máximo cinco emissões por hora/usuário, persistidos e serializados por lock da linha do usuário. A geração rejeita repetição de hashes recentes. O limitador de requisições também restringe e-mail/IP e falha fechado quando seu storage falha.
- Confirmar e consumir compartilham a mesma transação, inclusive no fluxo legado. Falha na atualização da conta reverte consumo. Duas confirmações simultâneas de código têm um único sucesso. Uma emissão que falha na entrega é revogada.
- A resposta de solicitação é uniforme para conta inexistente, já verificada ou envio suprimido por cooldown, evitando enumeração. Mensagens da interface usam linguagem de código e explicam caixa de entrada/spam.
- Não há reset de banco/contas/senhas nesta alteração. A migration cria somente a tabela `email_verification_codes` e seu índice; não apaga registros de links antigos.

## Arquitetura e testes

O envio e a confirmação usam casos de uso/repositórios separados da UI. A implementação PostgreSQL compartilha o lock da conta entre emissão, código e link legado. A configuração do e-mail mantém parâmetros legados para renderizadores anteriores, mas os novos envios sempre fornecem `verificationCode`, não um link. A documentação OpenAPI aceita as duas formas de POST.

Validação executada em 03/11/2026:

- TypeScript completo aprovado.
- Suite focada: **48 testes em sete arquivos aprovados**, incluindo **16 cenários HTTP reais com PostgreSQL local isolado**. Os bancos de teste exigem nome `sb_client_auth_test_*` e origem loopback; cada cenário cria/remove apenas seu schema aleatório. O DATABASE_URL padrão da suíte aponta para loopback bloqueado. Resend é substituído por capturador em memória, sem envio externo.
- Casos cobertos: cadastro CLIENT, intenção OWNER preservada, login bloqueado antes e permitido após confirmação, validade/expiração, zeros iniciais, armazenamento hash, rejeição de outro e-mail, cooldown/reenvio, invalidação de links, cinco erros, orçamento por hora, respostas uniformes, duas confirmações concorrentes, falha de entrega, falha de tabela sem vazamento, rollback forçado na ativação e migration aditiva repetida.
- Frontend relacionado: TypeScript aprovado, build Expo web aprovado e **30 testes focados aprovados**, incluindo os testes anteriores de concorrência/limpeza de links. Não houve migração de Expo. Há avisos preexistentes de resolução de tsconfig e act no harness, sem falhas.
- Compatibilidade LP: handler de redirecionamento verificado offline; deployment candidato comparou 73 títulos com a versão publicada, sem diferença. O destino e os headers foram conferidos antes da promoção.

## Publicação coordenada

1. Revisar/aprovar as alterações da API e do frontend antes do corte. Não publicar apenas o cliente novo contra a API antiga.
2. Publicar API pelo pipeline existente, com seu ambiente atual e migration aditiva. Não criar outro backend nem trocar DATABASE_URL. Se o banco ou as permissões forem diferentes do esperado, interromper.
3. Publicar o frontend correspondente no mesmo ciclo. Clientes que estavam com uma tela antiga aberta devem atualizar o app antes de solicitar/confirmar código novo. Links antigos válidos continuam compatíveis.
4. Conferir o contrato publicado e efetuar um cadastro em inbox controlada pelo responsável. Essa é a etapa de homologação real da entrega de e-mail; o fake e os testes HTTP locais não a substituem. Não enviar mensagens reais sem instrução do responsável nem usar conta existente para testes destrutivos.
5. Rollback: manter a tabela nova e seus dados. Não rodar down migration nem restaurar banco globalmente. Reverter cliente/backend de forma coordenada; códigos já emitidos não funcionam em uma API legada que só reconhece tokens. A conta que já foi confirmada deve continuar confirmada.

Esta entrega de código não equivale a prova de publicação da API/frontend. Registrar PRs, checks, gates de revisão e versões efetivamente publicadas antes de declarar o fluxo por código funcionando em produção.

Referências de segurança: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html e https://owasp.github.io/wstg/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/09-Testing_for_Weak_Password_Change_or_Reset_Functionalities . Os números de validade/cotas acima são decisões desta implementação, não uma alegação de exigência literal dessas referências.
