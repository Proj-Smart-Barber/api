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
                    barbershop: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: {
                          type: "string",
                          format: "uuid",
                        },
                        name: { type: "string" },
                        timezone: { type: "string" },
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
    "/api/barbershops/{shopId}": {
      get: {
        tags: ["Barbershops"],
        summary: "Get barbershop metadata",
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
            description: "Barbershop data retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    barbershop: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string" },
                        slug: { type: "string" },
                        cnpj: { type: "string" },
                        location: { type: "string" },
                        timezone: { type: "string" },
                        status: {
                          type: "string",
                          enum: ["ACTIVE", "INACTIVE"],
                        },
                        ownerId: { type: "string", format: "uuid" },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
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
        summary: "Get barbershop schedules",
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
        responses: {
          "200": {
            description: "Schedules retrieved successfully",
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
                          dayOfWeek: { type: "number" },
                          openTime: { type: "string" },
                          closeTime: { type: "string" },
                          barbershopId: { type: "string", format: "uuid" },
                          barbermanId: {
                            type: "string",
                            format: "uuid",
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
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["Schedules"],
        summary: "Update entire barbershop schedule",
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
                            "MONDAY",
                            "TUESDAY",
                            "WEDNESDAY",
                            "THURSDAY",
                            "FRIDAY",
                            "SATURDAY",
                            "SUNDAY",
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
          "204": {
            description: "Schedules updated successfully",
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
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
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/barbershops/{shopId}/schedule-exceptions": {
      get: {
        tags: ["Schedules"],
        summary: "Get schedule exceptions",
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
            description: "Exceptions retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    exceptions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          date: { type: "string", format: "date" },
                          startTime: { type: "string", nullable: true },
                          endTime: { type: "string", nullable: true },
                          reason: { type: "string", nullable: true },
                          barbershopId: { type: "string", format: "uuid" },
                          barbermanId: {
                            type: "string",
                            format: "uuid",
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
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Schedules"],
        summary: "Create a schedule exception",
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
                properties: {
                  date: { type: "string", format: "date" },
                  startTime: { type: "string", nullable: true },
                  endTime: { type: "string", nullable: true },
                  reason: { type: "string", nullable: true },
                  barbermanId: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Exception created successfully",
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
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
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/barbershops/{shopId}/schedule-exceptions/{exceptionId}": {
      patch: {
        tags: ["Schedules"],
        summary: "Update a schedule exception",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "exceptionId",
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
                properties: {
                  date: { type: "string", format: "date" },
                  startTime: { type: "string", nullable: true },
                  endTime: { type: "string", nullable: true },
                  reason: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Exception updated successfully",
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
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
                  properties: { message: { type: "string" } },
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
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Schedules"],
        summary: "Delete a schedule exception",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "exceptionId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "204": {
            description: "Exception deleted successfully",
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
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
                  properties: { message: { type: "string" } },
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
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/barbershops/{shopId}/availability": {
      get: {
        tags: ["Schedules"],
        summary: "Calculate barbershop availability slots",
        parameters: [
          {
            name: "shopId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "date",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
          },
          {
            name: "serviceIds",
            in: "query",
            required: true,
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
            description: "Availability slots retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    availability: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          time: { type: "string", example: "09:00" },
                          available: { type: "boolean", example: true },
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
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
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
