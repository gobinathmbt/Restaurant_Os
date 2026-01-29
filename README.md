# Restaurant Operating System

A comprehensive multi-tenant restaurant management system with offline-first capabilities.

## Project Structure

```
restaurant-os/
├── backend/          # Node.js/Express backend server
├── frontend/         # React/Vite web application
├── electron/         # Electron desktop application
└── .kiro/           # Kiro specs and configuration
```

## Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js 5.x
- **Database**: MongoDB 6.x with Mongoose ODM
- **Authentication**: JWT + bcrypt
- **Testing**: Jest + fast-check (property-based testing)

### Frontend
- **Framework**: React 19 with Vite 7.x
- **Styling**: Tailwind CSS 4.x
- **UI Components**: Radix UI
- **HTTP Client**: Axios
- **Routing**: React Router 7.x
- **Testing**: Vitest + @testing-library/react + fast-check

### Desktop
- **Framework**: Electron 40+
- **Local Database**: MongoDB (local instance)
- **Build**: electron-builder

## Getting Started

### Prerequisites
- Node.js v18 or higher
- MongoDB 6.x or higher
- npm or yarn

### Installation

1. **Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

2. **Frontend Setup**
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

3. **Electron Setup**
```bash
cd electron
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

## Development

### Backend
- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

### Frontend
- `npm run dev` - Start Vite development server (port 5173)
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

### Electron
- `npm start` - Start Electron app
- `npm run build` - Build distributable
- `npm run package` - Package without creating installer

## Architecture

The system follows a three-tier architecture:

1. **Backend Layer**: REST API server with MongoDB for data persistence
2. **Frontend Layer**: React web application with Tailwind CSS
3. **Desktop Layer**: Electron wrapper with local MongoDB for offline capabilities

### Multi-Tenancy
- **Platform Database**: System-wide data (companies, users, configuration)
- **Company Databases**: Each company gets a dedicated database for operational data

## License

ISC
