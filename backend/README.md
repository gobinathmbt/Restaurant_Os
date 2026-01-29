# ROS Backend

Restaurant Operating System (ROS) - Backend API Server

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration values

4. Start the development server:
```bash
npm run dev
```

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── models/          # Database models
│   │   ├── platform/    # Platform DB models
│   │   └── company/     # Company DB models
│   ├── controllers/     # Business logic controllers
│   ├── routes/          # API route definitions
│   ├── middlewares/     # Express middlewares
│   ├── services/        # Business logic services
│   └── utils/           # Utility functions
├── server.js            # Application entry point
├── package.json
└── .env.example
```

## Architecture

- **Platform Database**: Stores company registry, subscriptions, and platform settings
- **Company Databases**: Each company gets an isolated database (company_<companyId>)
- **MVC Pattern**: Models, Controllers, and Routes organized separately
- **JWT Authentication**: Token-based authentication with refresh tokens
- **Role-Based Access**: Platform admins and company-level roles

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
