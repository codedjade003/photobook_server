import swaggerJSDoc from "swagger-jsdoc";

const port = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === "production";
const serverUrl = isProd
  ? (process.env.API_BASE_URL || "https://your-render-service.onrender.com")
  : `http://localhost:${port}`;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Photobook Backend API",
      version: "1.0.0"
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    }
  },
  apis: ["./src/routes/*.js"]
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
