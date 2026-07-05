# Lead Flow

A comprehensive lead management and CRM system with sales pipeline management, team collaboration tools, and multi-channel integration.

## 🎯 Features

- **WhatsApp Integration** - Send/receive messages via WhatsApp Business API
- **Contact Management** - Full CRUD with segmentation and custom fields
- **Sales Pipeline** - Deal tracking with stages and revenue forecasting
- **Message Templates** - Pre-approved WhatsApp templates with bulk messaging
- **Meta Ads Integration** - Auto-create contacts from lead generation forms
- **Team Collaboration** - Role-based access control and activity logging
- **Real-time Chat** - WebSocket-powered messaging interface
- **Analytics & Reporting** - Comprehensive dashboards and metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- pnpm 8.6+

### Installation

```bash
# Clone the repository
cd lead-flow

# Install dependencies
pnpm install

# Setup environment variables
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local

# Setup database
cd apps/backend
pnpm prisma:generate
pnpm prisma:migrate

# Start development servers
cd ../..
pnpm dev
```

### Development

**Terminal 1 - Backend**
```bash
pnpm backend:dev
# Running on http://localhost:3001
```

**Terminal 2 - Frontend**
```bash
pnpm frontend:dev
# Running on http://localhost:3000
```

## 📁 Project Structure

```
lead-flow/
├── apps/
│   ├── backend/          # Express.js API server
│   └── frontend/         # Next.js React application
├── packages/
│   └── shared/           # Shared types and utilities
├── docker/               # Docker configuration
├── docs/                 # Documentation
└── scripts/              # Utility scripts
```

## 🛠️ Tech Stack

### Backend
- Node.js + Express.js
- TypeScript
- PostgreSQL + Prisma ORM
- Redis
- Socket.io (WebSocket)
- JWT Authentication

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- React Query
- Zustand (State Management)

## 📖 Documentation

- [Setup & Deployment Guide](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [WhatsApp Integration](docs/WHATSAPP_INTEGRATION.md)
- [API Documentation](docs/API.md)
- [Database Schema](docs/DATABASE.md)

## 🔗 Useful Links

- [WhatsApp Business API](https://www.whatsapp.com/business/developers)
- [Meta Developer Docs](https://developers.facebook.com)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js Documentation](https://nextjs.org/docs)

## 📝 Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/lead_flow
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
WHATSAPP_PHONE_ID=your-phone-id
WHATSAPP_BUSINESS_ACCOUNT_ID=your-account-id
WHATSAPP_ACCESS_TOKEN=your-token
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

## 🤝 Support

For support, email support@code2crest.com or visit https://docs.code2crest.com

## 📄 License

MIT License - see LICENSE file for details

---

Built with ❤️ for code2crest Technologies
