# Falha no envio de imagens em produção

## Diagnóstico confirmado

O navegador bloqueava o PUT de avatar, logo e galeria no preflight CORS do R2.
O bucket privado smartbarber permitia apenas a origem https://smartbarber.wellingtonsp.uk.
A aplicação utiliza https://app.smartbarber.wellingtonsp.uk.

OPTIONS com a origem atual retornou 403, sem Access-Control-Allow-Origin.
A origem anterior retornou 204. Os testes usaram um caminho inexistente, sem enviar arquivos,
sem credenciais e sem URLs assinadas.

## Configuração aplicada em produção

Em 11/11/2026, a origem https://app.smartbarber.wellingtonsp.uk foi adicionada
às regras existentes dos dois buckets, pelo painel Cloudflare.

| Bucket | Métodos | Cabeçalhos permitidos | Cabeçalhos expostos |
| --- | --- | --- | --- |
| smartbarber | PUT | Content-Type | ETag |
| smartbarber-public | GET, HEAD | Range | ETag, Content-Length |

As duas origens oficiais constam em AllowedOrigins. MaxAgeSeconds permanece em 3600.
Após a alteração, os três preflights com as duas origens retornaram 204.
Uma origem de controle não autorizada continuou retornando 403.

## Assinatura do upload

A versão instalada do AWS SDK gera um CRC32 automático ao assinar PutObject
e UploadPart sem Body. O teste reproduziu x-amz-checksum-crc32=AAAAAA==,
que representa o corpo vazio e difere dos bytes que o navegador enviará.

O patch em src/infra/storage/r2-storage-service.ts configura
requestChecksumCalculation como WHEN_REQUIRED para evitar esse cálculo sobre o corpo ausente.
A assinatura mantém a restrição de Content-Length. A confirmação continua responsável
pela inspeção do arquivo e pelo processamento das variantes.

## Evidências e limites

As duas regressões de assinatura falharam antes do patch e passaram após a alteração.
Os 21 testes seletivos de assinatura, armazenamento e casos de uso de mídia passaram.
Os testes de armazenamento usam um servidor HTTP em loopback.
A checagem TypeScript global encontrou cinco erros preexistentes em descoberta e cadastro
de barbearia. A execução com o código original confirmou os mesmos cinco erros.
A publicação do patch da API exige autorização específica conforme AGENTS.md.
A verificação do upload completo com uma imagem escolhida pelo usuário segue pendente.

Referências oficiais

- [CORS no R2](https://developers.cloudflare.com/r2/buckets/cors/)
- [Checksums do AWS SDK](https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html)

## Bloqueio de vagas após a liberação do CORS

A nova tentativa retornou o limite de duas intenções simultâneas.
O contador original inclui todas as mídias PENDING, independentemente da idade.
O frontend de avatar, logo e galeria também não cancela a intenção quando o PUT falha.

O patch local do frontend cancela somente a intenção cujo envio falhou.
Uma falha de confirmação após PUT concluído preserva a mídia para recuperação.
Se o cancelamento também falhar por conexão, o erro original do envio permanece disponível.

O patch local da API desconsidera intenções de imagem anteriores a 15 minutos
na verificação de simultaneidade, alinhando essa janela com a rota de retomada.
Sessões multipart ativas e não expiradas continuam incluídas no contador.
A limpeza física e a liberação de orçamento seguem no serviço de limpeza existente.

Os patches de assinatura e de vagas são propostos por pull request.
A publicação e a verificação integrada em produção seguem pendentes.
A configuração CORS já está aplicada em produção, mas esse bloqueio de vagas
ainda depende de intervenção autenticada sobre as tentativas ou de publicação do patch.
