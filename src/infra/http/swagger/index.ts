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
        summary: "Create a new user",
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
                  password: { type: "string", example: "secret123" },
                  cpf: { type: "string", example: "12345678901" },
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
        ],
        responses: {
          "200": {
            description: "Invitations retrieved successfully",
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
