# Contrato e Configuração de Links de Verificação de E-mail

Este documento especifica o contrato de configuração e resolução de links para verificação de e-mail e ativação de contas no Smart Barber.

## 1. Variáveis de Ambiente e Precedência

O serviço gerador de links (`buildEmailVerificationUrl`) utiliza a seguinte ordem de precedência:

1. **`EMAIL_VERIFICATION_URL`** (Opcional):
   - **Propósito**: URL completa e dedicada da tela de verificação no frontend.
   - **Comportamento**: Preserva integralmente o `pathname` configurado pelo operador.
   - **Exemplo**: `https://app.smartbarber.com.br/custom-verify` ou `http://localhost:8081/(auth)/verify-email`.

2. **`FRONTEND_URL`** (Opcional):
   - **Propósito**: Origem base da aplicação frontend.
   - **Comportamento**: Quando fornecida como origem (ex.: `https://app.smartbarber.com.br`), o serviço anexa o caminho canônico `/verify-email`.
   - **Exemplo**: `https://app.smartbarber.com.br` gera `https://app.smartbarber.com.br/verify-email?token=<token>`.

3. **`APP_URL`**:
   - **Proibição de Fallback**: `APP_URL` representa a URL pública da API backend (Swagger, webhooks, documentação OpenAPI). O gerador **NÃO** utiliza `APP_URL` como substituto implícito de telas de frontend.
   - **Comportamento de Falta de Configuração**: Caso nem `EMAIL_VERIFICATION_URL` nem `FRONTEND_URL` estejam configurados, o serviço lança um erro operacional recuperável de envio (`EmailSendError`), evitando que a API envie links com domínio errado ou falhe ao inicializar.

## 2. Validação Rigorosa de Segurança

- **Protocolos Suportados**: Apenas `https:` e `http:`.
- **Produção (`NODE_ENV === "production"`)**: Exige estritamente `https:`. Links `http:` são rejeitados para evitar exposição do token de ativação em trânsito.
- **Desenvolvimento Local (`NODE_ENV !== "production"`)**: Permite `http:` para viabilizar testes com emuladores e portas locais (ex.: `http://localhost:8081`).
- **Esquemas Proibidos**: `javascript:`, `data:`, `file:` e esquemas relativos são categoricamente bloqueados para prevenir ataques de Cross-Site Scripting (XSS) e injeção de URLs maliciosas.
- **Credenciais Embutidas**: URLs contendo usuário ou senha embutidos (ex.: `https://user:pass@host`) são rejeitadas para evitar SSRF e vazamento de credenciais.
- **Parâmetros e Fragmentos**: O parâmetro `token` é anexado de forma segura via `searchParams.set("token", plainToken)`. Fragmentos de URL (`#hash`) são descartados para prevenir quebras de roteamento.

## 3. Exemplos Fictícios de Configuração

### Desenvolvimento Local (.env.local fictício)
```env
# Frontend Expo Router (Web / Metro)
FRONTEND_URL="http://localhost:8081"

# Ou URL completa dedicada
EMAIL_VERIFICATION_URL="http://localhost:8081/(auth)/verify-email"
```

### Produção (.env.production fictício)
```env
# Domínio público seguro do frontend
FRONTEND_URL="https://app.smartbarber.com.br"

# URL da API permanece isolada para tráfego backend
APP_URL="https://api.smartbarber.com.br"
```

## 4. Limitações de Links Nativos
- **App Links / Universal Links**: Links HTTPS abrem nativamente a interface web ou deep linking caso os domínios associados estejam configurados no build de release do app. Em testes de browser ou sem o app compilado instalado no dispositivo, o link abre diretamente na interface web em `(auth)/verify-email`.

## 5. Reenvio e testes isolados

- Limite de envio: 3 solicitações por e-mail/minuto e 30 por IP/minuto, permitindo usuários distintos atrás do mesmo IP. IP vem de req.ip/socket; não são lidos cabeçalhos Forwarded arbitrários. A configuração de proxy da infraestrutura deve ser verificada antes de alterar trust proxy.
- Cota excedida retorna 429 com Retry-After. Falha ou resultado inválido do armazenamento retorna 503, sem prosseguir ao envio.
- Os novos testes de integração exigem SMARTBARBER_TEST_DATABASE_URL. Somente bancos locais com nome sb_client_auth_test_* são aceitos; cada teste cria/remove apenas seu schema aleatório. Não utilizam DATABASE_URL para limpar tabelas.
- Com essa variável explicitamente configurada para banco descartável, executar: `npx vitest run src/infra/http/client-onboarding.integration.spec.ts src/infra/http/middlewares/send-verification-email-limit.integration.spec.ts`.
- A integração HTTP captura mensagens em memória e não chama Resend. Isso comprova geração/consumo do link e autenticação, sem comprovar entrega a caixas postais externas.
