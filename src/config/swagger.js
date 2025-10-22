import swaggerJsdoc from "swagger-jsdoc";

const isDevelopment = process.env.NODE_ENV !== "production";
const baseUrl = isDevelopment 
  ? `http://localhost:${process.env.PORT || 5000}`
  : process.env.API_BASE_URL || "https://api.photobook.com";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Photobook API",
      version: "1.0.0",
      description: "API documentation for Photobook - A platform connecting photographers and clients",
      contact: {
        name: "Photobook Team",
      },
    },
    servers: [
      {
        url: baseUrl,
        description: isDevelopment ? "Development server" : "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Error message",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "User ID",
            },
            email: {
              type: "string",
              description: "User email",
            },
            name: {
              type: "string",
              description: "User name",
            },
            role: {
              type: "string",
              enum: ["client", "photographer"],
              description: "User role",
            },
            isVerified: {
              type: "boolean",
              description: "Email verification status",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Profile: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            user: {
              type: "string",
              description: "User ID reference",
            },
            bio: {
              type: "string",
            },
            location: {
              type: "string",
            },
            avatar: {
              type: "string",
              description: "Avatar URL",
            },
            portfolio: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                  },
                  caption: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [],
  },
  apis: ["./src/routes/*.js", "./src/server.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
