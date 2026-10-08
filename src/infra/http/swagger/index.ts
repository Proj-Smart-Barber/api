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
    "/api/users/": {
      post: {
        tags: ["Users"],
        summary: "Create a new account (auto sign-in)",
        description:
          "Creates the account as CLIENT and opens a session. The CPF is stored in canonical form (11 digits) and must be valid. Web clients receive the session cookie via Set-Cookie.",
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
                    example: "secret123",
                  },
                  cpf: {
                    type: "string",
                    example: "529.982.247-25",
                    description: "Com ou sem máscara; armazenado sem máscara",
                  },
                  phoneNumber: {
                    type: "string",
                    nullable: true,
                    example: "(11) 99999-9999",
                  },
                  callbackURL: {
                    type: "string",
                    nullable: true,
                    example: "/verify-email",
                    description:
                      "URL relativa, da origem configurada ou deep link (scheme://) para onde o link de verificação redireciona",
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
            headers: {
              "Set-Cookie": {
                description: "Cookie de sessão (clientes web)",
                schema: { type: "string" },
              },
            },
          },
          "400": {
            description:
              "Validation error (invalid CPF or weak password, min 8 chars)",
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
          "429": {
            description: "Too many requests",
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
        description:
          "Authenticates e-mail/password. The session TTL follows the account type: CLIENT/BARBER 30 days, OWNER/PLATFORM_ADMIN 8 hours. Web clients also receive the session cookie via Set-Cookie.",
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
                  callbackURL: {
                    type: "string",
                    nullable: true,
                    example: "/verify-email",
                  },
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
                      description: "Token da sessão (alias de token)",
                      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    },
                    token: {
                      type: "string",
                      description: "Token da sessão (guardar no SecureStore)",
                      example: "9f8e7d6c-...",
                    },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john@example.com" },
                        cpf: {
                          type: "string",
                          example: "52998224725",
                          description: "CPF canônico (11 dígitos)",
                        },
                        role: {
                          type: "string",
                          enum: ["CLIENT", "BARBER", "OWNER", "PLATFORM_ADMIN"],
                          example: "CLIENT",
                        },
                        emailVerified: { type: "boolean" },
                      },
                    },
                    expiresAt: {
                      type: "string",
                      format: "date-time",
                      example: "2026-11-07T18:00:00.000Z",
                    },
                  },
                },
              },
            },
            headers: {
              "Set-Cookie": {
                description: "Cookie de sessão (clientes web)",
                schema: { type: "string" },
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
                      example: "E-mail ou senha incorretos.",
                    },
                  },
                },
              },
            },
          },
          "429": {
            description: "Too many requests",
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
                        cpf: {
                          type: "string",
                          example: "52998224725",
                          description: "CPF canônico (11 dígitos)",
                        },
                        role: {
                          type: "string",
                          enum: ["CLIENT", "BARBER", "OWNER", "PLATFORM_ADMIN"],
                          example: "CLIENT",
                        },
                        emailVerified: { type: "boolean" },
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
    "/api/users/sessions/refresh": {
      post: {
        tags: ["Users"],
        summary: "Refresh the current session",
        description:
          "Extends the session following the account TTL (30 days for CLIENT/BARBER, 8 hours for OWNER/PLATFORM_ADMIN). Web sends the cookie automatically; native apps may send the token in the body or as Bearer.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: {
                    type: "string",
                    description:
                      "Token guardado no SecureStore (alternativa ao cookie/Bearer)",
                    example: "9f8e7d6c-...",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Session refreshed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    access_token: { type: "string" },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        role: {
                          type: "string",
                          enum: ["CLIENT", "BARBER", "OWNER", "PLATFORM_ADMIN"],
                        },
                      },
                    },
                    expiresAt: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Missing, invalid or expired session" },
        },
      },
    },
    "/api/users/sessions/logout": {
      post: {
        tags: ["Users"],
        summary: "Sign out of the current session",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Session closed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "boolean", example: true } },
                },
              },
            },
          },
          "401": { description: "Missing or invalid session" },
        },
      },
    },
    "/api/users/sessions/logout-all": {
      post: {
        tags: ["Users"],
        summary: "Sign out of every session of the user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "All sessions closed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "boolean", example: true } },
                },
              },
            },
          },
          "401": { description: "Missing or invalid session" },
        },
      },
    },
    "/api/users/email-verifications/request": {
      post: {
        tags: ["Users"],
        summary: "Request an e-mail verification link",
        description:
          "Always answers 200, even when the account does not exist (no account enumeration).",
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
                  callbackURL: {
                    type: "string",
                    nullable: true,
                    example: "/verify-email",
                    description:
                      "URL relativa, da origem configurada ou deep link (scheme://)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Request accepted (generic response)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "boolean", example: true } },
                },
              },
            },
          },
          "400": { description: "Validation or redirect URL error" },
          "429": { description: "Too many requests" },
        },
      },
    },
    "/api/users/email-verifications/confirm": {
      post: {
        tags: ["Users"],
        summary: "Confirm an e-mail verification token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: {
                  token: { type: "string", example: "eyJhbGciOi..." },
                  callbackURL: {
                    type: "string",
                    nullable: true,
                    example: "/verify-email",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "E-mail verified",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "boolean", example: true } },
                },
              },
            },
          },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/api/users/password-resets/request": {
      post: {
        tags: ["Users"],
        summary: "Request a password reset link",
        description:
          "Always answers 200, even when the account does not exist. Only the most recent link stays valid.",
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
                  redirectTo: {
                    type: "string",
                    nullable: true,
                    example: "/reset-password",
                    description:
                      "URL relativa, da origem configurada ou deep link (scheme://)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Request accepted (generic response)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "boolean", example: true } },
                },
              },
            },
          },
          "400": { description: "Validation or redirect URL error" },
          "429": { description: "Too many requests" },
        },
      },
    },
    "/api/users/password-resets/confirm": {
      post: {
        tags: ["Users"],
        summary: "Confirm a password reset token and set a new password",
        description:
          "Single-use token: after a successful reset (or a new request) previous links stop working. Resets revoke all sessions of the user.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: {
                  token: { type: "string", example: "ef1c0a4e-..." },
                  newPassword: {
                    type: "string",
                    minLength: 8,
                    example: "my-new-secret",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Password updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "boolean", example: true } },
                },
              },
            },
          },
          "400": {
            description: "Invalid/expired token or weak password",
          },
        },
      },
    },
    "/api/users/me/password": {
      patch: {
        tags: ["Users"],
        summary: "Change the password of the authenticated user",
        security: [{ bearerAuth: [] }],
        description:
          "Requires the current password. On success all other sessions and pending reset links are revoked.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: {
                    type: "string",
                    example: "current-secret",
                  },
                  newPassword: {
                    type: "string",
                    minLength: 8,
                    example: "my-new-secret",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Password changed (other sessions revoked)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "boolean", example: true },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Weak new password" },
          "401": {
            description: "Missing/invalid session or wrong current password",
          },
        },
      },
    },
    "/api/users/me/barbershops": {
      get: {
        tags: ["Users"],
        summary: "List the barbershops the authenticated user belongs to",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Barbershop memberships",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    barbershops: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          name: { type: "string", example: "Barbearia do Zé" },
                          role: {
                            type: "string",
                            enum: ["OWNER", "BARBER", "CLIENT"],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid session" },
        },
      },
    },
    "/api/barbershops/": {
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
    "/api/barbershops/{shopId}/schedules": {
      put: {
        tags: ["Schedules"],
        summary: "Update barbershop schedules",
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
          },
        ],
        requestBody: {
          required: true,
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
          },
          "400": {
            description: "Validation error",
          },
          "403": {
            description: "Forbidden (Not Allowed)",
          },
          "404": {
            description: "Barbershop not found",
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
        summary: "Cancel an existing booking",
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
        ],
        responses: {
          "200": {
            description: "Booking canceled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    booking: {
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
                        },
                        barbermanId: {
                          type: "string",
                          format: "uuid",
                        },
                        shoppingCartId: {
                          type: "string",
                          format: "uuid",
                        },
                        date: {
                          type: "string",
                          format: "date-time",
                        },
                        startTime: { type: "string", example: "14:00" },
                        endTime: { type: "string", example: "14:30" },
                      },
                    },
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
          "500": {
            description: "Internal server error",
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
  },
};
