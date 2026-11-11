const shop = {
  name: "shopId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const id = {
  name: "entryId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const security = [{ bearerAuth: [] }];
const responses = {
  200: { description: "Dados ou lançamento financeiro." },
  400: { description: "Campos ou competência inválidos." },
  401: { description: "Sessão inválida." },
  403: { description: "Membership OWNER ACTIVE obrigatória nesta unidade." },
  404: { description: "Recurso não encontrado nesta unidade." },
  409: { description: "Versão, chave de solicitação ou estado incompatível." },
  503: { description: "Financeiro temporariamente indisponível." },
};
const request = (properties: object, required: string[]) => ({
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        additionalProperties: false,
        properties,
        required,
      },
    },
  },
});
const requestId = { type: "string", format: "uuid" };
export const financePaths = {
  "/api/barbershops/{shopId}/finance": {
    get: {
      tags: ["Finance"],
      summary: "Resumo financeiro mensal da unidade",
      security,
      description:
        "Valores dos serviços concluídos e agendados, caixa registrado por data de pagamento e despesas por vencimento. Inclui alertas de preços ausentes e série diária.",
      parameters: [
        shop,
        {
          name: "month",
          in: "query",
          schema: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
          description:
            "Competência YYYY-MM. O padrão usa o mês atual da unidade.",
        },
      ],
      responses,
    },
  },
  "/api/barbershops/{shopId}/finance/entries": {
    post: {
      tags: ["Finance"],
      summary: "Cadastrar despesa com chave idempotente",
      security,
      parameters: [shop],
      responses,
      requestBody: request(
        {
          requestId,
          description: { type: "string", minLength: 2, maxLength: 160 },
          category: {
            type: "string",
            enum: ["FIXED", "VARIABLE", "BARBER_PAYOUT", "PAYROLL", "OTHER"],
          },
          amountInCents: { type: "integer", minimum: 1, maximum: 2000000000 },
          dueOn: { type: "string", format: "date" },
          payee: { type: "string", maxLength: 120 },
        },
        ["requestId", "description", "category", "amountInCents", "dueOn"],
      ),
    },
  },
  "/api/barbershops/{shopId}/finance/entries/{entryId}": {
    patch: {
      tags: ["Finance"],
      summary: "Registrar pagamento ou cancelar previsão de despesa",
      security,
      parameters: [shop, id],
      responses,
      requestBody: request(
        {
          action: { type: "string", enum: ["PAY", "CANCEL"] },
          expectedVersion: { type: "integer", minimum: 1 },
          paidOn: {
            type: "string",
            format: "date",
            description: "Obrigatório em PAY.",
          },
        },
        ["action", "expectedVersion"],
      ),
    },
  },
  "/api/barbershops/{shopId}/finance/entries/{entryId}/copy": {
    post: {
      tags: ["Finance"],
      summary: "Repetir despesa no próximo mês",
      security,
      parameters: [shop, id],
      responses,
      description:
        "Preserva valor, categoria e favorecido. Ajusta vencimento ao último dia do mês quando necessário. Repetições retornam a mesma cópia.",
      requestBody: request({ requestId }, ["requestId"]),
    },
  },
  "/api/barbershops/{shopId}/finance/receipts": {
    post: {
      tags: ["Finance"],
      summary: "Registrar recebimento integral de atendimento concluído",
      security,
      parameters: [shop],
      responses,
      description:
        "Valor obtido do snapshot da reserva. Exige COMPLETED e preço conhecido positivo. Cada reserva admite um recebimento.",
      requestBody: request(
        {
          requestId,
          bookingId: { type: "string", format: "uuid" },
          paidOn: { type: "string", format: "date" },
        },
        ["requestId", "bookingId", "paidOn"],
      ),
    },
  },
};
