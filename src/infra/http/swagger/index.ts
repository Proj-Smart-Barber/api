import { env } from "../../env";

export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "SmartBarber API",
    description: "Barbershop management and booking API",
    version: "1.0.0",
  },
  servers: [
    {
      url: env.APP_URL,
      description: "Development server",
    },
  ],
  paths: {
    "/": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Server is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "hello, world" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/docs-json": {
      get: {
        tags: ["System"],
        summary: "OpenAPI specification JSON",
        description:
          "Returns the raw OpenAPI 3.0 specification document for frontend/SDK generation",
        responses: {
          200: {
            description: "OpenAPI specification document",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
        },
      },
    },
    "/api/users": {
      post: {
        tags: ["Users"],
        summary: "Create a new user",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "cpf"],
                properties: {
                  name: { type: "string", example: "John Doe" },
                  email: {
                    type: "string",
                    format: "email",
                    example: "john@example.com",
                  },
                  password: {
                    type: "string",
                    minLength: 8,
                    description:
                      "Senha de segurança (mínimo de 8 caracteres e máximo de 72 bytes UTF-8)",
                    example: "minhasenhasegura123",
                  },
                  cpf: {
                    type: "string",
                    description:
                      "CPF (com ou sem máscara, validado por dígitos verificadores)",
                    example: "111.444.777-35",
                  },
                  onboardingIntent: {
                    type: "string",
                    enum: ["OWNER", "CLIENT"],
                    nullable: true,
                    description: "Intenção de onboarding ('OWNER' ou 'CLIENT')",
                    example: "CLIENT",
                  },
                  phoneNumber: {
                    type: "string",
                    nullable: true,
                    example: "(11) 99999-9999",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    userId: {
                      type: "string",
                      format: "uuid",
                      example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "409": {
            description: "CPF or email already in use",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "O CPF ou o E-mail já está em uso.",
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/users/sessions/auth": {
      post: {
        tags: ["Users"],
        summary: "Sign in and get access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "john@example.com",
                  },
                  password: { type: "string", example: "secret123" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Authentication successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    access_token: {
                      type: "string",
                      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    },
                    refresh_token: {
                      type: "string",
                      example: "0N8xq5m8Q3v1...",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "E-mail ou senha incorreto.",
                    },
                  },
                },
              },
            },
          },
          "403": {
            description: "Email not verified",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "email_not_verified",
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/users/sessions/refresh": {
      post: {
        tags: ["Users"],
        summary: "Refresh access token using a refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refresh_token"],
                properties: {
                  refresh_token: {
                    type: "string",
                    example: "0N8xq5m8Q3v1...",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Tokens refreshed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    access_token: { type: "string" },
                    refresh_token: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
          },
          "401": {
            description: "Invalid, expired or reused refresh token",
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
    "/api/users/sessions/sign-out": {
      post: {
        tags: ["Users"],
        summary: "Revoke a refresh token (sign out)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refresh_token"],
                properties: {
                  refresh_token: {
                    type: "string",
                    example: "0N8xq5m8Q3v1...",
                  },
                },
              },
            },
          },
        },
        responses: {
          "204": {
            description: "Refresh token revoked",
          },
          "400": {
            description: "Validation error",
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
    "/api/users/verification-email": {
      post: {
        tags: ["Users"],
        summary:
          "Send (or resend) the email verification link for a given email address",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "john@example.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Request accepted. The endpoint returns the same response whether the account exists, is already verified, or not, to avoid account enumeration.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sentTo: {
                      type: "string",
                      format: "email",
                      example: "john@example.com",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
          },
          "500": {
            description: "Email send failure",
          },
        },
      },
    },
    "/api/users/verification-email/confirm": {
      get: {
        tags: ["Users"],
        summary:
          "Confirm a user email using a verification token (target of the emailed link)",
        parameters: [
          {
            name: "token",
            in: "query",
            required: true,
            schema: {
              type: "string",
              example: "0N8xq5m8Q3v1...",
            },
          },
        ],
        responses: {
          "200": {
            description:
              "Email verified successfully (`alreadyVerified: true` when it was already verified)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    verified: {
                      type: "boolean",
                      example: true,
                    },
                    alreadyVerified: {
                      type: "boolean",
                      example: false,
                    },
                    userId: {
                      type: "string",
                      format: "uuid",
                    },
                    email: {
                      type: "string",
                      format: "email",
                    },
                    emailVerifiedAt: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing query parameter or invalid/expired token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
    "/api/users/password-recovery": {
      post: {
        tags: ["Users"],
        summary:
          "Send (or resend) a password recovery link for a given email address",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "john@example.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Request accepted. The endpoint returns the same response whether the account exists or not, to avoid account enumeration.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sentTo: {
                      type: "string",
                      format: "email",
                      example: "john@example.com",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
          },
          "500": {
            description: "Email send failure",
          },
        },
      },
    },
    "/api/users/password-recovery/reset": {
      post: {
        tags: ["Users"],
        summary: "Reset the account password using a recovery token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: {
                  token: {
                    type: "string",
                    example: "0N8xq5m8Q3v1...",
                  },
                  newPassword: {
                    type: "string",
                    minLength: 8,
                    example: "nova-senha-forte",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Password updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    userId: {
                      type: "string",
                      format: "uuid",
                    },
                    email: {
                      type: "string",
                      format: "email",
                    },
                    passwordUpdatedAt: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "Validation error, invalid/expired/used token, or password shorter than 8 characters",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
    "/api/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get authenticated user profile",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "User profile retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          format: "uuid",
                          example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                        },
                        name: { type: "string", example: "John Doe" },
                        email: {
                          type: "string",
                          example: "john@example.com",
                        },
                        avatarUrl: {
                          type: "string",
                          nullable: true,
                          example: null,
                        },
                        phoneNumber: {
                          type: "string",
                          nullable: true,
                          example: "(11) 99999-9999",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized - missing or invalid token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Recurso não encontrado.",
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/barbershops/": {
      get: {
        tags: ["Barbershops"],
        summary: "Busca textual paginada de barbearias públicas (modo ALL)",
        description:
          "Lista barbearias ativas ordenadas alfabeticamente por nome. Rejeita coordenadas geográficas nesta rota.",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string", maxLength: 120 },
            description: "Termo de busca textual por nome ou localização",
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1, minimum: 1 },
            description: "Número da página",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 20, minimum: 1, maximum: 50 },
            description: "Limite de registros por página (máximo 50)",
          },
        ],
        responses: {
          "200": {
            description: "Página de barbearias retornada com sucesso",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DiscoveryPage" },
              },
            },
          },
          "400": {
            description: "Erro de validação ou envio indevido de coordenadas",
          },
          "500": { description: "Internal server error" },
        },
      },
      post: {
        tags: ["Barbershops"],
        summary: "Create a barbershop",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["name", "cnpj", "location"],
                properties: {
                  name: {
                    type: "string",
                    minLength: 1,
                    example: "Barbearia do Zé",
                  },
                  cnpj: {
                    type: "string",
                    example: "12.345.678/0001-90",
                  },
                  location: {
                    type: "string",
                    minLength: 1,
                    example: "Rua X, 123 - São Paulo/SP",
                  },
                  timezone: {
                    type: "string",
                    example: "America/Sao_Paulo",
                  },
                  avatarUrl: {
                    type: "string",
                    format: "uri",
                    example: "https://example.com/barbershop.png",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Barbershop created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    barbershopId: {
                      type: "string",
                      format: "uuid",
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Missing or invalid authentication" },
          "404": { description: "Authenticated user not found" },
          "409": { description: "CNPJ or generated slug already in use" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/nearby": {
      post: {
        tags: ["Barbershops"],
        summary: "Busca de barbearias por proximidade geográfica (modo NEARBY)",
        description:
          "Busca unidades ativas com localização confirmada e recente dentro do raio especificado. Resposta com cabeçalho Cache-Control: no-store para proteção de privacidade do cliente.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["latitude", "longitude", "radiusKm"],
                properties: {
                  latitude: {
                    type: "number",
                    minimum: -90,
                    maximum: 90,
                    example: -23.55052,
                    description: "Latitude do ponto de busca",
                  },
                  longitude: {
                    type: "number",
                    minimum: -180,
                    maximum: 180,
                    example: -46.633308,
                    description: "Longitude do ponto de busca",
                  },
                  radiusKm: {
                    type: "integer",
                    enum: [5, 10, 25, 50],
                    example: 10,
                    description: "Raio de busca em quilômetros",
                  },
                  q: {
                    type: "string",
                    maxLength: 120,
                    example: "Centro",
                    description: "Filtro textual opcional",
                  },
                  page: {
                    type: "integer",
                    default: 1,
                    minimum: 1,
                    example: 1,
                  },
                  limit: {
                    type: "integer",
                    default: 20,
                    minimum: 1,
                    maximum: 50,
                    example: 20,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Lista de barbearias próximas ordenada por distância",
            headers: {
              "Cache-Control": {
                schema: { type: "string", example: "no-store" },
                description:
                  "Indica que a resposta não deve ser armazenada em cache por conter dados derivados de localização sensível",
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DiscoveryPage" },
              },
            },
          },
          "400": {
            description: "Erro de validação nos parâmetros de entrada",
          },
          "503": {
            description:
              "Serviço de manutenção de localização temporariamente indisponível",
          },
          "500": {
            description: "Erro interno no processamento de proximidade",
          },
        },
      },
    },
    "/api/barbershops/{shopId}": {
      get: {
        tags: ["Barbershops"],
        summary: "Get a barbershop by ID",
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            description: "Barbershop ID",
            schema: {
              type: "string",
              format: "uuid",
              example: "13d4b8e0-7f42-4b7f-b390-b06bb776701f",
            },
          },
        ],
        responses: {
          "200": {
            description: "Barbershop retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["barbershop"],
                  properties: {
                    barbershop: {
                      type: "object",
                      required: [
                        "id",
                        "name",
                        "ownerId",
                        "slug",
                        "cnpj",
                        "location",
                        "timezone",
                        "status",
                      ],
                      properties: {
                        id: {
                          type: "string",
                          format: "uuid",
                          example: "13d4b8e0-7f42-4b7f-b390-b06bb776701f",
                        },
                        name: {
                          type: "string",
                          example: "Barbearia do Zé",
                        },
                        avatarUrl: {
                          type: "string",
                          format: "uri",
                          nullable: true,
                          example: "https://example.com/barbershop.png",
                        },
                        ownerId: {
                          type: "string",
                          format: "uuid",
                          example: "4903d18d-ea6e-494e-9be6-ef9f47775034",
                        },
                        slug: {
                          type: "string",
                          example: "barbearia-do-ze",
                        },
                        cnpj: {
                          type: "string",
                          example: "12345678000190",
                        },
                        location: {
                          type: "string",
                          example: "Rua X, 123 - São Paulo/SP",
                        },
                        timezone: {
                          type: "string",
                          example: "America/Sao_Paulo",
                        },
                        status: {
                          type: "string",
                          enum: ["ACTIVE", "INACTIVE"],
                          example: "ACTIVE",
                        },
                        createdAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                          example: "2026-09-24T13:21:09.915Z",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Barbershop not found" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/services/": {
      get: {
        tags: ["Services"],
        summary: "List services of a barbershop",
        description:
          "Public readers only see services of an ACTIVE barbershop and only the active ones. The owner of the barbershop can authenticate and pass `includeInactive=true` to also receive deactivated services.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            description: "Barbershop ID",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: "includeInactive",
            in: "query",
            required: false,
            description:
              'Owner only. Accepts a boolean or the strings "true"/"false".',
            schema: { type: "boolean", default: false },
          },
        ],
        responses: {
          "200": {
            description: "Services retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["items", "total", "page", "limit"],
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Service" },
                    },
                    total: { type: "integer", example: 12 },
                    page: { type: "integer", example: 1 },
                    limit: { type: "integer", example: 20 },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "403": {
            description:
              "Forbidden - `includeInactive` requested by a non-owner of the barbershop",
          },
          "404": { description: "Barbershop not found" },
          "500": { description: "Internal server error" },
        },
      },
      post: {
        tags: ["Services"],
        summary: "Create a service in a barbershop (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            description: "Barbershop ID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "priceInCents", "durationInMinutes"],
                properties: {
                  title: {
                    type: "string",
                    minLength: 2,
                    maxLength: 100,
                    example: "Corte de Cabelo",
                  },
                  description: {
                    type: "string",
                    maxLength: 500,
                    nullable: true,
                    example: "Corte masculino tradicional",
                  },
                  priceInCents: {
                    type: "integer",
                    minimum: 1,
                    example: 5000,
                    description: "Price in cents (must be a positive integer).",
                  },
                  durationInMinutes: {
                    type: "integer",
                    minimum: 1,
                    example: 30,
                    description:
                      "Duration in minutes (must be a positive integer).",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Service created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["service"],
                  properties: {
                    service: { $ref: "#/components/schemas/Service" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid authentication" },
          "403": {
            description: "Forbidden - authenticated user is not the owner",
          },
          "404": {
            description: "Barbershop not found or inactive",
          },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/services/{serviceId}": {
      get: {
        tags: ["Services"],
        summary: "Get a service by ID",
        description:
          "Inactive services are only visible to the owner of the barbershop (requires authentication). Anonymous readers receive 404 for inactive services.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            description: "Barbershop ID",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "serviceId",
            in: "path",
            required: true,
            description: "Service ID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Service retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["service"],
                  properties: {
                    service: { $ref: "#/components/schemas/Service" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "404": {
            description:
              "Barbershop not found, service not found, or inactive service requested by a non-owner",
          },
          "500": { description: "Internal server error" },
        },
      },
      patch: {
        tags: ["Services"],
        summary: "Update a service (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            description: "Barbershop ID",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "serviceId",
            in: "path",
            required: true,
            description: "Service ID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    minLength: 2,
                    maxLength: 100,
                    example: "Corte de Cabelo Premium",
                  },
                  description: {
                    type: "string",
                    maxLength: 500,
                    nullable: true,
                    example: "Corte masculino com finalização",
                  },
                  priceInCents: {
                    type: "integer",
                    minimum: 1,
                    example: 6000,
                    description: "Price in cents (must be a positive integer).",
                  },
                  durationInMinutes: {
                    type: "integer",
                    minimum: 1,
                    example: 45,
                    description:
                      "Duration in minutes (must be a positive integer).",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Service updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["service"],
                  properties: {
                    service: { $ref: "#/components/schemas/Service" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid authentication" },
          "403": {
            description: "Forbidden - authenticated user is not the owner",
          },
          "404": {
            description: "Barbershop or service not found",
          },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/services/{serviceId}/activation": {
      patch: {
        tags: ["Services"],
        summary: "Activate or deactivate a service (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            description: "Barbershop ID",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "serviceId",
            in: "path",
            required: true,
            description: "Service ID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["isActive"],
                properties: {
                  isActive: {
                    type: "boolean",
                    example: true,
                    description:
                      'Desired activation state. The string "true"/"false" is also accepted.',
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Service activation toggled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["service"],
                  properties: {
                    service: { $ref: "#/components/schemas/Service" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid authentication" },
          "403": {
            description: "Forbidden - authenticated user is not the owner",
          },
          "404": {
            description: "Barbershop or service not found",
          },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/invitations": {
      post: {
        tags: ["Invitations"],
        summary: "Invite a barberman by email (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "barberman@example.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Invitation created and email sent",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    invitationId: { type: "string", format: "uuid" },
                    invitedEmail: { type: "string", format: "email" },
                    expiresAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "Validation error, not the owner, barbershop not found/inactive, already a member, duplicate pending invitation, or email send failure",
          },
          "401": { description: "Missing or invalid authentication" },
          "500": { description: "Internal server error" },
        },
      },
      get: {
        tags: ["Invitations"],
        summary: "List invitations of a barbershop (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1, minimum: 1 },
            description: "Número da página",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
            description: "Limite de itens por página",
          },
        ],
        responses: {
          "200": {
            description: "Invitations retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          email: { type: "string", format: "email" },
                          status: {
                            type: "string",
                            enum: [
                              "PENDING",
                              "ACCEPTED",
                              "DECLINED",
                              "REVOKED",
                            ],
                          },
                          role: {
                            type: "string",
                            enum: ["OWNER", "BARBERMAN"],
                          },
                          expiresAt: { type: "string", format: "date-time" },
                          respondedAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                          createdAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                        },
                      },
                    },
                    invitations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          email: { type: "string", format: "email" },
                          status: {
                            type: "string",
                            enum: [
                              "PENDING",
                              "ACCEPTED",
                              "DECLINED",
                              "REVOKED",
                            ],
                          },
                          role: {
                            type: "string",
                            enum: ["OWNER", "BARBERMAN"],
                          },
                          expiresAt: { type: "string", format: "date-time" },
                          respondedAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                          createdAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                        },
                      },
                    },
                    page: { type: "integer", example: 1 },
                    limit: { type: "integer", example: 20 },
                    total: { type: "integer", example: 1 },
                    hasNext: { type: "boolean", example: false },
                    serverTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "Validation error, not the owner, or barbershop not found",
          },
          "401": { description: "Missing or invalid authentication" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/invitations/{invitationId}/resend": {
      post: {
        tags: ["Invitations"],
        summary: "Resend an invitation with cooldown (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "invitationId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string" },
            description: "Chave de idempotência UUIDv7",
          },
        ],
        responses: {
          "200": {
            description: "Invitation resent successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    invitationId: { type: "string", format: "uuid" },
                    sentAt: { type: "string", format: "date-time" },
                    expiresAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error or invalid invitation state",
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - not unit owner" },
          "404": { description: "Invitation or barbershop not found" },
          "429": {
            description: "Cooldown active - wait 60s before resending",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example:
                        "Aguarde 60 segundos antes de reenviar este convite.",
                    },
                    code: { type: "string", example: "RESEND_COOLDOWN" },
                    retryAfterSeconds: { type: "integer", example: 60 },
                  },
                },
              },
            },
          },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/invitations/{invitationId}": {
      delete: {
        tags: ["Invitations"],
        summary: "Revoke a pending invitation (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "invitationId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Invitation revoked successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    revoked: { type: "boolean", example: true },
                    invitationId: { type: "string", format: "uuid" },
                    status: { type: "string", example: "REVOKED" },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "Validation error, not the owner, invitation not found, or invitation is not pending",
          },
          "401": { description: "Missing or invalid authentication" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List notifications for the authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Notifications retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notifications: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          type: {
                            type: "string",
                            example: "INVITATION_RECEIVED",
                          },
                          title: { type: "string" },
                          message: { type: "string" },
                          referenceType: {
                            type: "string",
                            nullable: true,
                            example: "INVITATION",
                          },
                          referenceId: {
                            type: "string",
                            format: "uuid",
                            nullable: true,
                          },
                          readAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                          scheduledAt: {
                            type: "string",
                            format: "date-time",
                          },
                          createdAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error or user not found" },
          "401": { description: "Missing or invalid authentication" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/invitations": {
      get: {
        tags: ["Invitations"],
        summary: "List pending invitations for the authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Pending invitations retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    invitations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          barbershopId: { type: "string", format: "uuid" },
                          barbershopName: {
                            type: "string",
                            nullable: true,
                          },
                          status: { type: "string", example: "PENDING" },
                          role: { type: "string", example: "BARBERMAN" },
                          expiresAt: { type: "string", format: "date-time" },
                          createdAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error or user not found" },
          "401": { description: "Missing or invalid authentication" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/invitations/accept": {
      post: {
        tags: ["Invitations"],
        summary: "Accept an invitation (authenticated invitee)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: {
                  token: { type: "string", example: "0N8xq5m8Q3v1..." },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Invitation accepted and barberman membership created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    accepted: { type: "boolean", example: true },
                    invitationId: { type: "string", format: "uuid" },
                    barbershopId: { type: "string", format: "uuid" },
                    barbermanId: { type: "string", format: "uuid" },
                    status: { type: "string", example: "ACCEPTED" },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "Validation error, invalid/expired/used token, email mismatch, or already a member",
          },
          "401": { description: "Missing or invalid authentication" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/invitations/decline": {
      post: {
        tags: ["Invitations"],
        summary: "Decline an invitation (authenticated invitee)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: {
                  token: { type: "string", example: "0N8xq5m8Q3v1..." },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Invitation declined successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    declined: { type: "boolean", example: true },
                    invitationId: { type: "string", format: "uuid" },
                    status: { type: "string", example: "DECLINED" },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "Validation error, invalid/expired/used token, or email mismatch",
          },
          "401": { description: "Missing or invalid authentication" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/bookings/barberman/schedule": {
      get: {
        tags: ["Bookings"],
        summary: "Fetch authenticated barberman daily schedule with IDs only",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "date",
            required: true,
            schema: {
              type: "string",
              format: "date",
            },
            example: "2026-09-11",
            description: "Date in YYYY-MM-DD format",
          },
        ],
        responses: {
          "200": {
            description: "Daily schedule retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    bookings: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string",
                            format: "uuid",
                            example: "9e241c16-650f-492e-9cda-320f8c0b16c3",
                          },
                          barbershopId: {
                            type: "string",
                            format: "uuid",
                            example: "13d4b8e0-7f42-4b7f-b390-b06bb776701f",
                          },
                          barbermanId: {
                            type: "string",
                            format: "uuid",
                            example: "4903d18d-ea6e-494e-9be6-ef9f47775034",
                          },
                          shoppingCartId: {
                            type: "string",
                            format: "uuid",
                            example: "09a90c95-1ef3-4cac-9a0a-ff03aa902022",
                          },
                          date: {
                            type: "string",
                            format: "date-time",
                            example: "2026-09-11T00:00:00.000Z",
                          },
                          startTime: { type: "string", example: "14:00" },
                          endTime: { type: "string", example: "14:30" },
                          createdAt: {
                            type: "string",
                            format: "date-time",
                            example: "2026-09-11T13:21:09.915Z",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/bookings/me": {
      get: {
        tags: ["Bookings"],
        summary: "Fetch customer bookings or authoritative upcoming booking",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "view",
            required: false,
            schema: { type: "string", enum: ["all", "upcoming"] },
            description:
              "View mode: 'all' for paginated history, 'upcoming' for active/future bookings ordered by start time",
          },
          {
            in: "query",
            name: "limit",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 50 },
            description:
              "Number of bookings to return (default 1 for upcoming, 20 for all)",
          },
          {
            in: "query",
            name: "page",
            required: false,
            schema: { type: "integer", minimum: 1 },
            description: "Page number for pagination",
          },
        ],
        responses: {
          200: {
            description: "Bookings retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    bookings: {
                      type: "array",
                      items: { type: "object" },
                    },
                    serverTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
          },
        },
      },
    },
    "/api/bookings": {
      post: {
        tags: ["Bookings"],
        summary: "Create a new booking (personal or unit scope)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "header",
            name: "Idempotency-Key",
            required: false,
            schema: { type: "string" },
            description:
              "Optional UUIDv7 idempotency key for durable execution",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["barbermanId", "date", "startTime"],
                properties: {
                  scope: {
                    type: "string",
                    enum: ["PERSONAL", "UNIT"],
                    default: "PERSONAL",
                  },
                  shopId: { type: "string", format: "uuid" },
                  customerId: { type: "string", format: "uuid" },
                  serviceId: {
                    type: "string",
                    format: "uuid",
                    description: "Legacy single service ID",
                  },
                  serviceIds: {
                    type: "array",
                    items: { type: "string", format: "uuid" },
                    description: "Array of service IDs",
                  },
                  barbermanId: {
                    type: "string",
                    format: "uuid",
                    example: "4903d18d-ea6e-494e-9be6-ef9f47775034",
                  },
                  date: {
                    type: "string",
                    format: "date",
                    example: "2026-09-11",
                    description: "Date in YYYY-MM-DD format",
                  },
                  startTime: { type: "string", example: "14:00" },
                  slotStartAt: {
                    type: "string",
                    format: "date-time",
                    description:
                      "Selected instant; must match date/time in unit timezone and participates in the idempotency hash",
                  },
                  endTime: { type: "string", example: "14:30" },
                  expectedTotalPriceInCents: { type: "integer", example: 5000 },
                  expectedDurationInMinutes: { type: "integer", example: 30 },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Booking created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    booking: { $ref: "#/components/schemas/BookingDto" },
                    serverTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Missing or invalid authentication",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "403": {
            description:
              "Forbidden - actor cannot book on behalf of third-party in PERSONAL scope or lacks permissions",
          },
          "404": {
            description: "Service, professional or barbershop not found",
          },
          "409": {
            description:
              "Conflict (SLOT_UNAVAILABLE, QUOTE_CHANGED, MEMBERSHIP_INACTIVE, CUSTOMER_NOT_ELIGIBLE, IDEMPOTENCY_PAYLOAD_MISMATCH)",
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/barbershops/{shopId}/schedules": {
      get: {
        tags: ["Schedules"],
        summary:
          "Fetch barbershop general schedule or professional schedule scope",
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "barbermanId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
            description:
              "Optional professional ID to fetch individual schedule scope",
          },
        ],
        responses: {
          "200": {
            description:
              "Schedules retrieved successfully with state and effective intervals",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    schedules: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          dayOfWeek: { type: "string" },
                          openTime: { type: "string" },
                          closeTime: { type: "string" },
                        },
                      },
                    },
                    effectiveSchedules: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          dayOfWeek: { type: "string" },
                          openTime: { type: "string" },
                          closeTime: { type: "string" },
                        },
                      },
                    },
                    state: {
                      type: "string",
                      enum: ["INHERIT", "CUSTOM", "CLOSED"],
                    },
                    version: { type: "integer" },
                    needsReview: { type: "boolean" },
                    serverTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "404": {
            description: "Barbershop not found",
          },
        },
      },
      put: {
        tags: ["Schedules"],
        summary: "Update general barbershop schedule or professional schedule",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "barbermanId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
            description:
              "Target professional ID. If omitted, targets unit general schedule (OWNER only)",
          },
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string" },
            description:
              "Optional UUIDv7 idempotency key for durable execution",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  state: {
                    type: "string",
                    enum: ["INHERIT", "CUSTOM", "CLOSED"],
                    description: "Explicit individual schedule state",
                  },
                  expectedVersion: {
                    type: "integer",
                    description: "Optimistic concurrency control version",
                  },
                  requestId: {
                    type: "string",
                    description: "Optional request identifier",
                  },
                  schedules: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["dayOfWeek", "openTime", "closeTime"],
                      properties: {
                        dayOfWeek: {
                          type: "string",
                          enum: [
                            "SUNDAY",
                            "MONDAY",
                            "TUESDAY",
                            "WEDNESDAY",
                            "THURSDAY",
                            "FRIDAY",
                            "SATURDAY",
                          ],
                        },
                        openTime: { type: "string", example: "09:00" },
                        closeTime: { type: "string", example: "18:00" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Schedules updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    state: {
                      type: "string",
                      enum: ["INHERIT", "CUSTOM", "CLOSED"],
                    },
                    version: { type: "integer" },
                    schedules: { type: "array", items: { type: "object" } },
                    effectiveSchedules: {
                      type: "array",
                      items: { type: "object" },
                    },
                    serverTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error or invalid schedule containment",
          },
          "403": {
            description:
              "Forbidden (Not Allowed: Inactive membership, colleague, or unit mismatch)",
          },
          "404": {
            description: "Barbershop not found",
          },
          "409": {
            description:
              "Conflict: SCHEDULE_BOOKING_CONFLICT (with conflicting bookings array) or SCHEDULE_VERSION_CONFLICT",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    code: {
                      type: "string",
                      example: "SCHEDULE_BOOKING_CONFLICT",
                    },
                    message: { type: "string" },
                    conflicts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          bookingId: { type: "string", format: "uuid" },
                          startsAt: { type: "string", format: "date-time" },
                          endsAt: { type: "string", format: "date-time" },
                          status: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/bookings/barberman/schedule/details": {
      get: {
        tags: ["Bookings"],
        summary:
          "Fetch authenticated barberman daily schedule with customer and service details",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "date",
            required: true,
            schema: {
              type: "string",
              format: "date",
            },
            example: "2026-09-11",
            description: "Date in YYYY-MM-DD format",
          },
        ],
        responses: {
          "200": {
            description: "Daily schedule retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    bookings: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string",
                            format: "uuid",
                            example: "9e241c16-650f-492e-9cda-320f8c0b16c3",
                          },
                          barbershopId: {
                            type: "string",
                            format: "uuid",
                            example: "13d4b8e0-7f42-4b7f-b390-b06bb776701f",
                          },
                          barbermanId: {
                            type: "string",
                            format: "uuid",
                            example: "4903d18d-ea6e-494e-9be6-ef9f47775034",
                          },
                          shoppingCartId: {
                            type: "string",
                            format: "uuid",
                            example: "09a90c95-1ef3-4cac-9a0a-ff03aa902022",
                          },
                          customer: {
                            type: "object",
                            properties: {
                              id: {
                                type: "string",
                                format: "uuid",
                                example: "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
                              },
                              name: { type: "string", example: "John Doe" },
                              phoneNumber: {
                                type: "string",
                                example: "(11) 99999-9999",
                              },
                            },
                          },
                          services: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: {
                                  type: "string",
                                  format: "uuid",
                                  example:
                                    "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
                                },
                                title: {
                                  type: "string",
                                  example: "Corte de Cabelo",
                                },
                                priceInCents: {
                                  type: "integer",
                                  example: 5000,
                                },
                                durationInMinutes: {
                                  type: "integer",
                                  example: 30,
                                },
                              },
                            },
                          },
                          date: {
                            type: "string",
                            format: "date-time",
                            example: "2026-09-11T00:00:00.000Z",
                          },
                          startTime: { type: "string", example: "14:00" },
                          endTime: { type: "string", example: "14:30" },
                          createdAt: {
                            type: "string",
                            format: "date-time",
                            example: "2026-09-11T13:21:09.915Z",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/bookings/{bookingId}/cancel": {
      delete: {
        tags: ["Bookings"],
        summary: "Cancel an existing booking logically",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "bookingId",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
            description: "ID of the booking to be canceled",
          },
          {
            in: "header",
            name: "Idempotency-Key",
            required: true,
            schema: { type: "string" },
            description: "UUIDv7 idempotency key",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["expectedVersion"],
                properties: {
                  expectedVersion: { type: "integer", example: 1 },
                  reason: { type: "string", example: "Imprevisto pessoal" },
                  scope: {
                    type: "string",
                    enum: ["PERSONAL", "UNIT"],
                    example: "PERSONAL",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Booking canceled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    booking: { $ref: "#/components/schemas/BookingDto" },
                    serverTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Forbidden - Not allowed to cancel this booking",
          },
          "404": {
            description: "Booking not found",
          },
          "409": {
            description:
              "Conflict - BOOKING_VERSION_CONFLICT, ACTION_DEADLINE_PASSED or TERMINAL_BOOKING_STATE",
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
    "/api/barbershops/{shopId}/team": {
      get: {
        tags: ["Team"],
        summary: "List unit team members (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Barbershop unit ID",
          },
          {
            name: "state",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
            description: "Filter by membership state",
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1, minimum: 1 },
            description: "Page number",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
            description: "Items per page (max 100)",
          },
        ],
        responses: {
          "200": {
            description: "Unit team members retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    members: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          membershipId: { type: "string", format: "uuid" },
                          barbershopId: { type: "string", format: "uuid" },
                          userId: { type: "string", format: "uuid" },
                          name: { type: "string" },
                          email: { type: "string", format: "email" },
                          role: { type: "string", example: "BARBER" },
                          state: {
                            type: "string",
                            enum: ["ACTIVE", "INACTIVE"],
                          },
                          version: { type: "integer", example: 1 },
                          joinedAt: { type: "string", format: "date-time" },
                          endedAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                        },
                      },
                    },
                    total: { type: "integer", example: 1 },
                    page: { type: "integer", example: 1 },
                    limit: { type: "integer", example: 20 },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - not unit owner" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/team/{membershipId}/deactivation": {
      patch: {
        tags: ["Team"],
        summary: "Deactivate a team member membership (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Barbershop unit ID",
          },
          {
            name: "membershipId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Membership ID to deactivate",
          },
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string" },
            description: "Optional idempotency key for durable execution",
          },
        ],
        responses: {
          "200": {
            description:
              "Membership deactivated successfully (or replayed idempotent response)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    membershipId: { type: "string", format: "uuid" },
                    state: { type: "string", example: "INACTIVE" },
                    version: { type: "integer", example: 2 },
                    endedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error or cannot deactivate unit owner",
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - not unit owner" },
          "404": { description: "Membership not found" },
          "409": {
            description:
              "Conflict - active/future bookings or concurrent version conflict",
          },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/team/{membershipId}": {
      get: {
        tags: ["Team"],
        summary: "Get team member details (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Barbershop unit ID",
          },
          {
            name: "membershipId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Membership ID",
          },
        ],
        responses: {
          "200": {
            description: "Member details retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    member: {
                      type: "object",
                      properties: {
                        membershipId: { type: "string", format: "uuid" },
                        userId: { type: "string", format: "uuid" },
                        name: { type: "string" },
                        role: { type: "string", example: "BARBERMAN" },
                        state: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
                        version: { type: "integer", example: 1 },
                        joinedAt: { type: "string", format: "date-time" },
                        endedAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        avatarUrl: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - not unit owner" },
          "404": { description: "Member or barbershop not found" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/barber-registrations": {
      post: {
        tags: ["Team"],
        summary: "Initiate professional registration for a barber (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Barbershop unit ID",
          },
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "Chave de idempotência UUIDv7",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "cpf", "email"],
                properties: {
                  name: { type: "string", example: "Carlos Barbeiro" },
                  cpf: { type: "string", example: "123.456.789-00" },
                  email: {
                    type: "string",
                    format: "email",
                    example: "carlos@barbearia.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Registration initiated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    registrationId: { type: "string", format: "uuid" },
                    invitationId: { type: "string", format: "uuid" },
                    email: { type: "string", format: "email" },
                    status: { type: "string", example: "PENDING" },
                    requiresExistingAccountLogin: {
                      type: "boolean",
                      example: false,
                    },
                    expiresAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error or missing idempotency key" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - not unit owner" },
          "404": { description: "Barbershop not found or inactive" },
          "409": {
            description:
              "Conflict (IDENTITY_CONFLICT, ALREADY_A_MEMBER, PENDING_INVITATION_EXISTS)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    code: { type: "string", example: "IDENTITY_CONFLICT" },
                  },
                },
              },
            },
          },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbers/activate": {
      post: {
        tags: ["Barbers"],
        summary:
          "Activate barber account with password (public via email link)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: {
                  token: {
                    type: "string",
                    description: "Token recebido por e-mail",
                  },
                  password: {
                    type: "string",
                    description:
                      "Nova senha (mínimo 8 caracteres, máximo 72 bytes)",
                    example: "senhasegura123",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Account activated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    userId: { type: "string", format: "uuid" },
                    email: { type: "string", format: "email" },
                    status: { type: "string", example: "COMPLETED" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid or expired token, or invalid password",
          },
          "409": {
            description: "Account already exists (requires login instead)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    code: { type: "string", example: "account_already_exists" },
                  },
                },
              },
            },
          },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/operation-attempts/{requestId}": {
      get: {
        tags: ["Operations"],
        summary:
          "Consult idempotent operation attempt by request ID (actor only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "requestId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Idempotency request ID",
          },
        ],
        responses: {
          "200": {
            description: "Operation attempt details",
            headers: {
              "Cache-Control": {
                schema: { type: "string", example: "no-store" },
                description: "Durable non-cacheable operational response",
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    attempt: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        actorId: { type: "string", format: "uuid" },
                        requestId: { type: "string" },
                        resourceKind: {
                          type: "string",
                          example: "MEMBERSHIP_DEACTIVATION",
                        },
                        resourceId: { type: "string", nullable: true },
                        state: {
                          type: "string",
                          enum: ["PENDING", "APPLIED", "NOT_APPLIED"],
                        },
                        responsePayload: { type: "object", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                        closedAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "404": {
            description: "Attempt not found or belongs to another actor",
          },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/operation-attempts/{requestId}/close": {
      post: {
        tags: ["Operations"],
        summary: "Close an in-flight operation attempt fence (actor only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "requestId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Idempotency request ID",
          },
        ],
        responses: {
          "200": {
            description: "Attempt closed or confirmed",
            headers: {
              "Cache-Control": {
                schema: { type: "string", example: "no-store" },
                description: "Durable non-cacheable operational response",
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    closed: { type: "boolean", example: true },
                    attempt: { type: "object" },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "Attempt cannot be closed (already terminal or applied)",
          },
          "401": { description: "Unauthorized" },
          "404": {
            description: "Attempt not found or belongs to another actor",
          },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/api/barbershops/{shopId}/customers/lookup": {
      post: {
        tags: ["Bookings", "Barbershop"],
        summary:
          "Lookup customer by exact email or CPF (staff only, rate limited)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Barbershop unit ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "cliente@exemplo.com",
                  },
                  cpf: {
                    type: "string",
                    example: "123.456.789-00",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Customer found and returned with masked data",
            headers: {
              "Cache-Control": {
                schema: { type: "string", example: "no-store" },
                description: "Security header preventing customer PII caching",
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CustomerLookupResponse" },
              },
            },
          },
          "400": { description: "Invalid CPF or email format" },
          "401": { description: "Unauthorized" },
          "403": {
            description: "Forbidden - user not an active staff member of unit",
          },
          "404": { description: "Customer not found" },
          "429": {
            description: "Too Many Requests - limit of 30 lookups/min exceeded",
            headers: {
              "Retry-After": {
                schema: { type: "integer", example: 60 },
                description: "Seconds until rate limit reset",
              },
            },
          },
          "503": {
            description: "Service Unavailable - rate limiter counter failure",
          },
        },
      },
    },
    "/api/barbershops/{shopId}/bookings": {
      get: {
        tags: ["Bookings", "Barbershop"],
        summary: "List unit bookings with SQL summary (staff only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 20, maximum: 100 },
          },
          {
            name: "date",
            in: "query",
            required: false,
            schema: { type: "string", format: "date", example: "2026-10-15" },
            description: "Filter bookings on a specific date (YYYY-MM-DD)",
          },
          {
            name: "startDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
          },
          {
            name: "endDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "barbermanId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "List of unit bookings with summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UnitBookingsResponse" },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - not an active staff member" },
        },
      },
    },
    "/api/bookings/{bookingId}/reschedule": {
      patch: {
        tags: ["Bookings"],
        summary: "Atomically reschedule an existing booking",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "bookingId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["date", "startTime", "expectedVersion"],
                properties: {
                  expectedVersion: { type: "integer", example: 1 },
                  date: {
                    type: "string",
                    format: "date",
                    example: "2026-10-15",
                  },
                  startTime: { type: "string", example: "15:00" },
                  slotStartAt: {
                    type: "string",
                    format: "date-time",
                    description:
                      "Selected instant; must match date/time in unit timezone and participates in the idempotency hash",
                  },
                  barbermanId: { type: "string", format: "uuid" },
                  serviceIds: {
                    type: "array",
                    items: { type: "string", format: "uuid" },
                  },
                  expectedTotalPriceInCents: { type: "integer", example: 5000 },
                  expectedDurationInMinutes: { type: "integer", example: 45 },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Booking rescheduled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    booking: { $ref: "#/components/schemas/BookingDto" },
                    serverTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Booking not found" },
          "409": {
            description:
              "Conflict (SLOT_UNAVAILABLE, QUOTE_CHANGED, BOOKING_VERSION_CONFLICT, ACTION_DEADLINE_PASSED)",
          },
        },
      },
    },
    "/api/bookings/{bookingId}/status": {
      patch: {
        tags: ["Bookings"],
        summary: "Record attendance status transition (COMPLETED or NO_SHOW)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "UUIDv7 idempotency key",
          },
          {
            name: "bookingId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status", "expectedVersion"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["COMPLETED", "NO_SHOW"],
                    example: "COMPLETED",
                  },
                  expectedVersion: { type: "integer", example: 1 },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Status updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    booking: { $ref: "#/components/schemas/BookingDto" },
                    serverTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - only unit staff" },
          "404": { description: "Booking not found" },
          "409": {
            description:
              "Conflict (ACTION_DEADLINE_PASSED, BOOKING_VERSION_CONFLICT, TERMINAL_BOOKING_STATE)",
          },
        },
      },
    },
    "/api/barbershops/{shopId}/location": {
      get: {
        tags: ["Location", "Barbershops"],
        summary: "Consultar estado da localização comercial da barbearia",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID da unidade barbearia",
          },
        ],
        responses: {
          "200": {
            description: "Estado da localização retornado com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    shopId: { type: "string", format: "uuid" },
                    address: { type: "string" },
                    status: {
                      type: "string",
                      enum: ["CONFIRMED", "UNCONFIRMED", "NEEDS_REVIEW"],
                    },
                    source: {
                      type: "string",
                      enum: ["GOOGLE", "MANUAL"],
                    },
                    version: { type: "integer" },
                    point: {
                      type: "object",
                      nullable: true,
                      properties: {
                        latitude: { type: "number" },
                        longitude: { type: "number" },
                      },
                    },
                    confirmedAt: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                    },
                    acquiredAt: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                    },
                    validUntil: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                    },
                    lastOwnerMutation: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string" },
                        commandHash: { type: "string" },
                        savedVersion: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "403": {
            description:
              "Proibido: Apenas proprietário ativo da unidade pode consultar a localização comercial",
          },
          "404": {
            description: "Barbearia não encontrada",
          },
        },
      },
      patch: {
        tags: ["Location", "Barbershops"],
        summary: "Atualizar e confirmar localização comercial da barbearia",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID da unidade barbearia",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "address",
                  "candidateId",
                  "latitude",
                  "longitude",
                  "expectedVersion",
                  "mutationId",
                ],
                properties: {
                  address: { type: "string", minLength: 3, maxLength: 255 },
                  candidateId: { type: "string", format: "uuid" },
                  latitude: { type: "number", minimum: -90, maximum: 90 },
                  longitude: { type: "number", minimum: -180, maximum: 180 },
                  expectedVersion: { type: "integer", minimum: 0 },
                  mutationId: { type: "string", minLength: 1, maxLength: 128 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Localização atualizada e confirmada com sucesso",
          },
          "400": {
            description: "Parâmetros inválidos ou candidato expirado",
          },
          "403": {
            description:
              "Proibido: Não autorizado ou candidato pertence a outro usuário/unidade",
          },
          "404": {
            description:
              "Barbearia ou candidato de geocodificação não encontrado",
          },
          "409": {
            description:
              "Conflito: LOCATION_VERSION_CONFLICT ou IDEMPOTENCY_PAYLOAD_MISMATCH",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    code: {
                      type: "string",
                      example: "LOCATION_VERSION_CONFLICT",
                    },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/geocoding/search": {
      post: {
        tags: ["Location"],
        summary: "Buscar candidatos de endereço via Google Geocoding",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["address"],
                properties: {
                  address: { type: "string", minLength: 3, maxLength: 255 },
                  shopId: { type: "string", format: "uuid", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Candidatos encontrados retornados com validade efêmera",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    candidates: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          formattedAddress: { type: "string" },
                          latitude: { type: "number" },
                          longitude: { type: "number" },
                          placeId: { type: "string" },
                          expiresAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                    serverTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Erro de validação dos parâmetros",
          },
          "403": {
            description:
              "Proibido: Usuário não tem permissão na unidade informada",
          },
          "429": {
            description: "Limite de requisições ao provedor atingido",
          },
        },
      },
    },
    "/api/internal/locations/refresh": {
      get: {
        tags: ["Internal"],
        summary:
          "Varredura periódica de manutenção geográfica (expirações e health heartbeat)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Varredura de manutenção executada com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "OK" },
                    sweptLocationsCount: { type: "integer", example: 0 },
                    deletedCandidatesCount: { type: "integer", example: 5 },
                    heartbeatAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Token CRON_SECRET ausente ou inválido",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      Service: {
        type: "object",
        required: [
          "id",
          "barbershopId",
          "title",
          "priceInCents",
          "durationInMinutes",
          "isActive",
        ],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
          },
          barbershopId: {
            type: "string",
            format: "uuid",
            example: "13d4b8e0-7f42-4b7f-b390-b06bb776701f",
          },
          title: {
            type: "string",
            example: "Corte de Cabelo",
          },
          description: {
            type: "string",
            nullable: true,
            example: "Corte masculino tradicional",
          },
          priceInCents: {
            type: "integer",
            example: 5000,
          },
          durationInMinutes: {
            type: "integer",
            example: 30,
          },
          isActive: {
            type: "boolean",
            example: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-09-24T13:21:09.915Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-09-24T13:21:09.915Z",
          },
        },
      },
      BookingDto: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          barbershopId: { type: "string", format: "uuid" },
          barbermanId: { type: "string", format: "uuid" },
          customerId: { type: "string", format: "uuid" },
          shoppingCartId: { type: "string", format: "uuid", nullable: true },
          customer: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string", example: "Carlos Silva" },
              phoneNumber: { type: "string", nullable: true },
            },
          },
          services: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid", nullable: true },
                serviceId: { type: "string", format: "uuid", nullable: true },
                title: { type: "string" },
                priceInCents: { type: "integer", nullable: true },
                durationInMinutes: { type: "integer", nullable: true },
                legacyAggregate: { type: "boolean" },
              },
            },
          },
          startsAt: { type: "string", format: "date-time", nullable: true },
          endsAt: { type: "string", format: "date-time", nullable: true },
          timezone: { type: "string", example: "America/Sao_Paulo" },
          status: { type: "string", example: "CONFIRMED" },
          version: { type: "integer", example: 1 },
          createdByUserId: { type: "string", format: "uuid", nullable: true },
          clientRequestId: { type: "string", nullable: true },
          totalPriceInCents: { type: "integer", nullable: true },
          totalDurationInMinutes: { type: "integer", nullable: true },
          date: { type: "string", format: "date-time" },
          startTime: { type: "string", example: "14:00" },
          endTime: { type: "string", example: "14:45" },
          createdAt: { type: "string", format: "date-time" },
          canCancel: { type: "boolean", example: true },
          canReschedule: { type: "boolean", example: true },
          canComplete: { type: "boolean", example: false },
          canMarkNoShow: { type: "boolean", example: false },
          capabilities: {
            type: "object",
            properties: {
              cancel: {
                type: "object",
                properties: {
                  allowed: { type: "boolean" },
                  reasonCode: { type: "string", nullable: true },
                  deadlineAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                },
              },
              reschedule: {
                type: "object",
                properties: {
                  allowed: { type: "boolean" },
                  reasonCode: { type: "string", nullable: true },
                  deadlineAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                },
              },
              complete: {
                type: "object",
                properties: {
                  allowed: { type: "boolean" },
                  reasonCode: { type: "string", nullable: true },
                  deadlineAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                },
              },
              noShow: {
                type: "object",
                properties: {
                  allowed: { type: "boolean" },
                  reasonCode: { type: "string", nullable: true },
                  deadlineAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                },
              },
            },
          },
          serverTime: { type: "string", format: "date-time" },
        },
      },
      CustomerLookupResponse: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "João Santos" },
          maskedEmail: { type: "string", example: "j***o@exemplo.com" },
          maskedPhone: { type: "string", example: "(11) *****-1234" },
          isEligible: { type: "boolean", example: true },
          unconfirmedEmail: { type: "boolean", example: false },
        },
      },
      UnitBookingsResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/BookingDto" },
          },
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 1 },
          hasNext: { type: "boolean", example: false },
          serverTime: { type: "string", format: "date-time" },
          summary: {
            type: "object",
            properties: {
              totalBookings: { type: "integer", example: 1 },
              totalAmountInCents: { type: "integer", example: 5000 },
              statusCounts: {
                type: "object",
                additionalProperties: { type: "integer" },
              },
              hasIncompleteData: { type: "boolean", example: false },
            },
          },
        },
      },
      PublicShop: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Barbearia Vintage" },
          slug: { type: "string", example: "barbearia-vintage" },
          location: {
            type: "string",
            example: "Rua Augusta, 1000 - Consolação, São Paulo - SP",
          },
          avatarUrl: {
            type: "string",
            format: "uri",
            nullable: true,
            example: "https://example.com/avatar.jpg",
          },
          coordinates: {
            type: "object",
            nullable: true,
            properties: {
              latitude: { type: "number", example: -23.55052 },
              longitude: { type: "number", example: -46.633308 },
            },
            required: ["latitude", "longitude"],
          },
          distanceMeters: {
            type: "number",
            nullable: true,
            example: 1250,
            description:
              "Distância em metros até o ponto de busca (nulo no modo ALL)",
          },
        },
        required: ["id", "name", "slug", "location"],
      },
      DiscoveryPage: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/PublicShop" },
          },
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 42 },
          hasNext: { type: "boolean", example: true },
          serverTime: { type: "string", format: "date-time" },
        },
        required: ["items", "page", "limit", "total", "hasNext", "serverTime"],
      },
    },
  },
};
