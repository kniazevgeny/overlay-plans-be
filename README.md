# Overlay Plans

A Telegram bot with mini-app integration for coordinating plans and schedules among groups of people.

## Features

- Telegram bot interface for creating and managing plans
- Multi-language support
- Text and voice message processing for natural language scheduling
- Visualization of time slots and schedules
- Mini-app integration for rich UI experience

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
# or 
yarn install
```

3. Configure environment variables by creating a `.env` file:
```
TG_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
WEBAPP_URL=https://your-webapp-url.com
DATABASE_PATH=overlay-plans.sqlite
```

4. Start the application:
```bash
npm run start:dev
# or
yarn start:dev
```

## Technical Details

The application is built using:
- NestJS for the backend
- TypeORM for database interaction
- SQLite for data storage
- Telegraf for Telegram Bot API integration

## Development

To run in development mode:
```bash
npm run start:dev
# or
yarn start:dev
```

### Database Structure

The application uses three main entities:
- **User**: Represents a Telegram user
- **Project**: A collection of plans/schedules
- **TimeSlot**: A specific time slot associated with a project and user

## LLM Integration

The bot can process natural language messages to extract scheduling information. The current implementation simulates this process, but can be extended to use GPT or other LLMs for more sophisticated processing.

## Mini-App Frontend

The mini-app frontend should be hosted separately and the URL should be set in the `.env` file. The mini-app provides a rich UI for creating projects, viewing and editing time slots.

## License

[MIT](LICENSE)

# Timeslot WebSocket Server

This project provides a WebSocket server implementation for timeslot management in projects. It provides the same functionality as the OpenAI function-calling tools but through a real-time Socket.io interface.

## Features

- Real-time timeslot management via Socket.io
- Add, update, delete, and merge timeslots
- Get timeslots for a specific user in a project
- Broadcasts timeslot updates to all connected clients

## Installation

1. Make sure you have [Node.js](https://nodejs.org/) installed (version 14 or higher)
2. Install the required dependencies:

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

## WebSocket API

The WebSocket server exposes the following methods:

### 1. Add Timeslots

```javascript
// Event: project_add_timeslots
// Payload:
{
  projectId: number;
  userId: number;
  timeslots: [
    {
      startTime: string; // ISO 8601 format
      endTime: string; // ISO 8601 format
      notes?: string;
      status: 'available' | 'busy';
      isLocked?: boolean;
      label?: string;
      color?: string;
    }
  ];
  createdById?: number; // Optional
}
```

### 2. Update Timeslots

```javascript
// Event: project_update_timeslots
// Payload:
{
  projectId: number;
  timeslots: [
    {
      id: number;
      startTime?: string; // ISO 8601 format
      endTime?: string; // ISO 8601 format
      notes?: string;
      status?: 'available' | 'busy';
      isLocked?: boolean;
      label?: string;
      color?: string;
    }
  ];
  requestUserId: number;
}
```

### 3. Delete Timeslots

```javascript
// Event: project_delete_timeslots
// Payload:
{
  projectId: number;
  timeslotIds: number[];
  requestUserId: number;
}
```

### 4. Merge Timeslots

```javascript
// Event: project_merge_timeslots
// Payload:
{
  projectId: number;
  timeslotIds: number[];
  requestUserId: number;
  mergedNotes?: string;
}
```

### 5. Get User Timeslots

```javascript
// Event: get_user_timeslots
// Payload:
{
  projectId: number;
  userId: number;
}
```

## WebSocket Events

The server broadcasts the following events:

### Timeslots Updated

```javascript
// Event: timeslots_updated
// Payload:
{
  projectId: number;
  userId?: number; // Only included for add_timeslots
}
```

## Demo Client

A demo HTML/JavaScript client is included in the project (`websocket-client.html`). You can use this to test the WebSocket API.

1. Start the server: `npm run start`
2. Open the `websocket-client.html` file in a browser
3. Connect to the WebSocket server (default URL: `http://localhost:3000`)
4. Use the interface to test the various timeslot operations

## Adding to Existing Projects

To add this Socket.io server to an existing NestJS project:

1. Add the TimeslotGateway to your NestJS module:

```typescript
import { TimeslotGateway } from './timeslot.gateway';

@Module({
  // ...
  providers: [
    // ...
    TimeslotGateway,
  ],
})
export class AppModule {}
```

2. Make sure you have the necessary Socket.io packages installed:

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

3. Create a custom Socket.io adapter in `socket.io-adapter.ts`:

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplication } from '@nestjs/common';

export class SocketIoAdapter extends IoAdapter {
  constructor(private app: INestApplication) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*', // In production, replace with specific domains
        methods: ['GET', 'POST'],
        credentials: true,
      },
      allowEIO3: true, // Allows compatibility with older clients
    });

    return server;
  }
}
```

4. Enable Socket.io in your main.ts file:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import { SocketIoAdapter } from './socket.io-adapter';

async function bootstrap() {
  const app: INestApplication = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.enableCors();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`WebSocket server is listening on port ${port}`);
}
bootstrap();
```

## Client Usage Example

```javascript
// Connect to the WebSocket server
const socket = io('http://localhost:3000');

// Listen for connection
socket.on('connect', () => {
  console.log('Connected to WebSocket server');
});

// Add a timeslot
socket.emit('project_add_timeslots', {
  projectId: 1,
  userId: 1,
  timeslots: [
    {
      startTime: '2023-05-01T10:00:00Z',
      endTime: '2023-05-01T11:00:00Z',
      status: 'available',
      notes: 'Weekly meeting'
    }
  ]
}, (response) => {
  console.log('Timeslot added:', response);
});

// Listen for timeslot updates
socket.on('timeslots_updated', (data) => {
  console.log('Timeslots updated:', data);
  // Refresh your UI or fetch the latest timeslots
});
```
