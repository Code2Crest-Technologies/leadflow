# Lead Flow - Setup Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- pnpm 8.6+

## 1. Installation

### Clone and Install

```bash
cd lead-flow
pnpm install
```

### Setup Environment Variables

**Backend**
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your configuration
```

**Frontend**
```bash
cp apps/frontend/.env.example apps/frontend/.env.local
# Edit apps/frontend/.env.local
```

## 2. Database Setup

```bash
cd apps/backend

# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Seed database (optional)
pnpm prisma:seed
```

## 3. Development

### Terminal 1 - Backend
```bash
cd apps/backend
pnpm dev
# Running on http://localhost:3001
```

### Terminal 2 - Frontend
```bash
cd apps/frontend
pnpm dev
# Running on http://localhost:3000
```

### Terminal 3 - Redis (if not running as service)
```bash
redis-server
```

## 4. WhatsApp Integration

### Get Your Credentials

1. **Meta Business Account**: https://business.facebook.com
2. **WhatsApp Manager**: Setup WhatsApp Business Account
3. **Get Phone Number ID**: From WhatsApp Manager API Setup
4. **Get Business Account ID**: From Business Settings
5. **Generate Access Token**: Settings > User Access Tokens

### Configure Webhook

1. In Meta App Dashboard, go to WhatsApp > Configuration
2. Set Webhook URL: `https://yourdomain.com/api/webhook/whatsapp`
3. Verify Token: Use `WEBHOOK_VERIFY_TOKEN` from .env
4. Subscribe to: `messages`, `message_status`, `message_template_status_update`

### Create Message Templates

1. In WhatsApp Manager, go to Message Templates
2. Create templates (minimum 1 for testing)
3. Wait for approval (usually instant for testing templates)

## 5. Docker Setup (Optional)

### Build and Run

```bash
# Copy environment file
cp docker/.env.example .env

# Edit .env with your values

# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Testing

### Run Tests
```bash
# Backend tests
cd apps/backend
pnpm test

# Frontend tests
cd apps/frontend
pnpm test
```

### Test WhatsApp Webhook

```bash
# Verify webhook
curl "http://localhost:3001/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=your-token&hub.challenge=test"

# Send test message
curl -X POST http://localhost:3001/api/messages/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "to": "+1234567890",
    "message": "Hello from WhatsApp CRM!"
  }'
```

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify credentials

### WhatsApp API Errors
- Verify phone number format (with country code)
- Check access token validity
- Check rate limits

### WebSocket Connection Issues
- Verify SOCKET_URL environment variable
- Check CORS settings
- Check browser console for errors

## Next Steps

1. ✅ Verify database connection
2. ✅ Create user accounts
3. ✅ Configure WhatsApp templates
4. ✅ Setup webhook
5. ✅ Test message sending
6. ✅ Deploy to production

## Support

For issues:
- Check logs in backend terminal
- Review .env configuration
- Check WhatsApp API documentation
- Visit https://docs.code2crest.com
