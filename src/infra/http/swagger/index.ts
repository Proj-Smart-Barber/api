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
    "/api/staffs/": {
      post: {
        tags: ["Staffs"],
        summary: "Create a new staff member",
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
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Staff member created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    staffId: {
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
    "/api/staffs/sessions/auth": {
      post: {
        tags: ["Staffs"],
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
    "/api/staffs/me": {
      get: {
        tags: ["Staffs"],
        summary: "Get authenticated staff profile",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Staff profile retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    staff: {
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
                        role: {
                          type: "string",
                          enum: ["OWNER", "BARBER"],
                          example: "OWNER",
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
            description: "Staff member not found",
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
    "/api/booking/barberman/{barbermanId}/schedule": {
      get: {
        tags: ["Bookings"],
        summary: "Fetch barberman daily schedule with IDs only",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "barbermanId",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
            description: "ID do barbeiro",
          },
          {
            in: "query",
            name: "date",
            required: true,
            schema: {
              type: "string",
              format: "date",
            },
            example: "2026-09-11",
            description: "Data da agenda no formato YYYY-MM-DD",
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
    "/api/booking/barberman/{barbermanId}/schedule/details": {
      get: {
        tags: ["Bookings"],
        summary:
          "Fetch barberman daily schedule with customer and service details",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "barbermanId",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
            description: "ID do barbeiro",
          },
          {
            in: "query",
            name: "date",
            required: true,
            schema: {
              type: "string",
              format: "date",
            },
            example: "2026-09-11",
            description: "Data da agenda no formato YYYY-MM-DD",
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
