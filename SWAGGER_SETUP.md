# Swagger API Documentation Setup

## Overview

Swagger/OpenAPI documentation has been added to the Photobook API. The documentation is automatically generated from JSDoc comments in the route files and is accessible via a web interface.

## Accessing the Documentation

### Development
- **URL**: `http://localhost:5000/api-docs`
- The base URL for API calls will automatically be set to `http://localhost:5000`

### Production
- **URL**: `https://your-domain.com/api-docs`
- Set the `API_BASE_URL` environment variable to your production API URL
- Example: `API_BASE_URL=https://api.photobook.com`

## Environment Variables

Add these to your `.env` file:

```env
# Required for Swagger in production
API_BASE_URL=https://api.photobook.com

# NODE_ENV determines which base URL is used
NODE_ENV=development  # or 'production'
```

## Configuration

The Swagger configuration is located in `src/config/swagger.js` and includes:

- **Conditional Base URL**: Automatically switches between localhost (development) and production URL
- **Bearer Authentication**: JWT token support for protected endpoints
- **Comprehensive Schemas**: User, Profile, and Error response models
- **Auto-discovery**: Scans all route files in `src/routes/*.js` for JSDoc comments

## How It Works

1. **Development Mode** (`NODE_ENV !== "production"`):
   - Base URL: `http://localhost:{PORT}`
   - Server description: "Development server"

2. **Production Mode** (`NODE_ENV === "production"`):
   - Base URL: Value from `API_BASE_URL` environment variable
   - Fallback: `https://api.photobook.com`
   - Server description: "Production server"

## Adding Documentation to New Endpoints

Use JSDoc comments above your route definitions:

```javascript
/**
 * @swagger
 * /api/your-endpoint:
 *   post:
 *     summary: Brief description
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success response
 *       401:
 *         description: Unauthorized
 */
router.post("/your-endpoint", yourHandler);
```

## Features

- **Interactive UI**: Test API endpoints directly from the browser
- **Authentication Support**: Add JWT tokens via the "Authorize" button
- **Request/Response Examples**: See expected data formats
- **Schema Validation**: View required fields and data types
- **Multiple Environments**: Seamlessly switch between dev and prod

## Customization

To customize the Swagger UI appearance or behavior, edit `src/server.js`:

```javascript
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Photobook API Docs"
}));
```

## Tags Used

- **Authentication**: Login, signup, social auth, password reset
- **User**: User profile management, role updates
- **Profiles**: Photographer and client profile operations

## Security

- Protected endpoints require JWT token authentication
- Use the "Authorize" button in Swagger UI to add your token
- Format: `Bearer <your-jwt-token>`

## Troubleshooting

### Swagger UI not loading
- Ensure the server is running on the correct port
- Check that `swagger-jsdoc` and `swagger-ui-express` are installed
- Verify route files are in `src/routes/` directory

### Base URL incorrect
- Check `NODE_ENV` environment variable
- Verify `API_BASE_URL` is set correctly in production
- Restart the server after changing environment variables

### Documentation not updating
- Swagger scans files at server startup
- Restart the server to see changes in JSDoc comments
