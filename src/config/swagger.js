import swaggerJSDoc from "swagger-jsdoc";

const port = process.env.PORT || 5000;
const productionServerUrl = "https://photobook-server.onrender.com";
const localServerUrl = `http://localhost:${port}`;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Photobook Backend API",
      version: "1.0.0",
      description: "Core API for authentication, role selection, profiles, portfolio uploads, rate cards, and session booking.\n\nAuth instructions:\n- Use `Authorization: Bearer <jwt>` for protected routes.\n- Signup and login return JWTs.\n\nPrimary route groups:\n- `/api/auth`\n- `/api/profiles`\n- `/api/portfolio`\n- `/api/rate-card`\n- `/api/sessions`"
    },
    servers: [
      { url: productionServerUrl, description: "Production (Render)" },
      { url: localServerUrl, description: "Local development" }
    ],
    tags: [
      { name: "Auth", description: "Signup, login, role selection, and account actions" },
      { name: "Profiles", description: "Client and photographer profile management" },
      { name: "Portfolio", description: "Photographer media upload/list/delete" },
      { name: "RateCard", description: "Photographer pricing and package rows" },
      { name: "Sessions", description: "Event types and session booking flow" },
      { name: "Users", description: "Account lifecycle actions" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Invalid credentials" }
          }
        }
      }
    }
  },
  apis: ["./src/routes/*.js"]
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
