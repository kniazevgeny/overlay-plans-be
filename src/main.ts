import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import { SocketIoAdapter } from './socket.io-adapter';

async function bootstrap() {
  const app: INestApplication = await NestFactory.create(AppModule);

  // Enable CORS for HTTP requests
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Use our custom Socket.io adapter with proper configuration
  app.useWebSocketAdapter(new SocketIoAdapter(app));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`WebSocket server is listening on port ${port}`);
}
bootstrap();
