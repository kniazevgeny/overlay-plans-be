import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions, Server } from 'socket.io';
import { INestApplication } from '@nestjs/common';

/**
 * Custom Socket.io adapter with proper configuration
 */
export class SocketIoAdapter extends IoAdapter {
  constructor(private app: INestApplication) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    // If port is 0, use the same port as the HTTP server
    if (port === 0) {
      port = parseInt(process.env.PORT ?? '3000', 10);
    }

    console.log(`Creating Socket.IO server on port ${port}`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*', // In production, replace with specific domains
        methods: ['GET', 'POST'],
        credentials: true,
      },
      allowEIO3: true, // Allows compatibility with older clients
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    console.log('Socket.IO server created successfully');
    return server;
  }
}
