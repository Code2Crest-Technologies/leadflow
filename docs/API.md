# API Documentation

## Authentication

### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "user": { id, email, firstName, lastName, role }
}
```

### Refresh Token
```
POST /api/auth/refresh
Authorization: Bearer refresh-token

Response:
{
  "accessToken": "new-jwt-token"
}
```

## Contacts

### Get Contacts
```
GET /api/contacts
Authorization: Bearer token
Query: ?page=1&limit=20&segment=LEAD

Response:
{
  "data": [ { id, phoneNumber, firstName, lastName, segment, status, ... } ],
  "pagination": { page, limit, total }
}
```

### Create Contact
```
POST /api/contacts
Authorization: Bearer token
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "segment": "LEAD"
}

Response:
{
  "id": "contact-id",
  "phoneNumber": "+1234567890",
  ...
}
```

## Messages

### Send Message
```
POST /api/messages/send
Authorization: Bearer token
Content-Type: application/json

{
  "conversationId": "conv-id",
  "contactId": "contact-id",
  "content": "Hello!",
  "messageType": "TEXT"
}

Response:
{
  "id": "message-id",
  "status": "sent",
  "whatsappMessageId": "wamid.xxx"
}
```

### Get Conversation Messages
```
GET /api/messages/conversation/:conversationId
Authorization: Bearer token

Response:
{
  "data": [ { id, content, status, createdAt, ... } ]
}
```

## Webhooks

### WhatsApp Webhook
```
POST /api/webhook/whatsapp

Payload:
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "id": "msg-id",
          "from": "+1234567890",
          "text": { "body": "Hello" },
          "timestamp": "1234567890"
        }],
        "statuses": [{
          "id": "msg-id",
          "status": "delivered|read|failed"
        }]
      }
    }]
  }]
}

Response:
{ "received": true }
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "details": { "field": ["error message"] }
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "message": "Token expired or invalid"
}
```

### 500 Server Error
```json
{
  "error": "Internal server error",
  "message": "Error details in development mode"
}
```

## Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **WhatsApp Messages**: 1000 messages per 24 hours per phone number

## WebSocket Events

### Connect
```javascript
const socket = io('http://localhost:3001');
socket.on('connect', () => {
  console.log('Connected to real-time updates');
});
```

### Listen for New Message
```javascript
socket.on('message:new', (data) => {
  console.log('New message:', data.message);
  console.log('Contact:', data.contact);
  console.log('Conversation:', data.conversation);
});
```

### Listen for Message Status Update
```javascript
socket.on('message:status-update', (data) => {
  console.log('Message', data.messageId, 'status:', data.status);
});
```

### Emit Message
```javascript
socket.emit('message:send', {
  conversationId: 'conv-id',
  content: 'Hello!'
});
```
