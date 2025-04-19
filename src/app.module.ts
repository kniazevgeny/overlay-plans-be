import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { User } from './entities/user.entity';
import { Project } from './entities/project.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { OpenAIService } from './openai.service';
import { UserSearchService } from './telegram/services/user-search.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite',
        database: configService.get<string>(
          'DATABASE_PATH',
          'overlay-plans.sqlite',
        ),
        entities: [User, Project, TimeSlot],
        synchronize: true, // Set to false in production
      }),
    }),
    TypeOrmModule.forFeature([User, Project, TimeSlot]),
  ],
  controllers: [AppController],
  providers: [AppService, TelegramService, OpenAIService, UserSearchService],
})
export class AppModule {}
