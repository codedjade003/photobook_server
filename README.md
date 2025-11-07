# Photobook API

A Node.js/Express backend API for connecting photographers with clients.

## Features

- 🔐 **Authentication**: Email/password, Google, Facebook, Apple Sign-In
- 👤 **User Management**: Photographer and client profiles
- 📸 **Portfolio Management**: Upload and manage photography portfolios
- 🔒 **JWT Authentication**: Secure API endpoints
- 📧 **Email Verification**: Account verification and password reset
- 📚 **API Documentation**: Interactive Swagger/OpenAPI docs
- 💓 **Health Monitoring**: Built-in health check endpoint
- ☁️ **Cloud Storage**: AWS S3 integration for media files

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- MongoDB
- AWS S3 account (for file uploads)
- SMTP server (for emails)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.development.variables .env

# Edit .env with your actual values
nano .env

# Start development server
npm run dev
```

### Environment Variables

See `.env.development.variables` for all required variables:

- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `API_BASE_URL` - Your API base URL
- `S3_BUCKET_NAME` - AWS S3 bucket name
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- OAuth credentials (Google, Facebook)
- SMTP settings for emails

## API Documentation

Interactive API documentation is available via Swagger UI:

**Development**: `http://localhost:5000/api-docs`

**Production**: `https://your-domain.com/api-docs`

See [SWAGGER_SETUP.md](./SWAGGER_SETUP.md) for detailed documentation setup.

## Deployment

### Render

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for:
- Complete deployment guide
- Keep-alive setup for free tier
- Environment configuration
- Health check setup

### Other Platforms

The app works on any Node.js hosting platform:
- Heroku
- Railway
- Fly.io
- DigitalOcean App Platform
- AWS Elastic Beanstalk

## Scripts

```bash
# Development with auto-reload
npm run dev

# Production
npm start

# Keep-alive service (for Render free tier)
npm run keepalive
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/facebook` - Facebook OAuth login
- `POST /api/auth/apple` - Apple Sign-In
- `POST /api/auth/verify-email` - Verify email address
- `POST /api/auth/password-reset/request` - Request password reset
- `POST /api/auth/password-reset/confirm` - Confirm password reset
- `POST /api/auth/resend-verification` - Resend verification email

### User Management
- `GET /api/auth/me` - Get current user (protected)
- `PUT /api/auth/profile` - Update user profile (protected)
- `PATCH /api/auth/role` - Update user role (protected)

### Profiles
- `GET /api/profiles/:id` - Get user profile (public)
- `PUT /api/profiles/creative` - Update photographer profile (protected)
- `PUT /api/profiles/client` - Update client profile (protected)
- `POST /api/profiles/creative/portfolio` - Upload portfolio item (protected)
- `DELETE /api/profiles/creative/portfolio/:itemId` - Delete portfolio item (protected)
- `POST /api/profiles/avatar` - Upload avatar (protected)

### Health
- `GET /health` - Health check endpoint

## Project Structure

```
photobook_server/
├── src/
│   ├── config/          # Configuration files
│   │   ├── db.js        # MongoDB connection
│   │   ├── passport.js  # Passport strategies
│   │   ├── swagger.js   # Swagger/OpenAPI config
│   │   └── multerS3.js  # File upload config
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   └── server.js        # Express app entry point
├── scripts/
│   └── keepAlive.js     # Keep-alive script for Render
├── .env                 # Environment variables (create from .env.development.variables)
├── package.json
└── README.md
```

## Authentication

Protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Get a token by logging in via `/api/auth/login` or any OAuth endpoint.

## Development

### Running Locally

1. Start MongoDB locally or use MongoDB Atlas
2. Configure environment variables
3. Run `npm run dev`
4. Access API at `http://localhost:5000`
5. View docs at `http://localhost:5000/api-docs`

### Testing Endpoints

Use the Swagger UI or tools like:
- Postman
- Insomnia
- curl
- HTTPie

Example:
```bash
# Health check
curl http://localhost:5000/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

## Security

- Passwords are hashed with bcrypt
- JWT tokens expire after 1 hour
- Email verification required for new accounts
- Role-based access control
- Secure file uploads with type validation
- Environment variables for sensitive data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC

## Support

For issues and questions:
- Check the documentation files
- Review API docs at `/api-docs`
- Open an issue on GitHub
