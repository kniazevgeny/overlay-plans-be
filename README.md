
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
