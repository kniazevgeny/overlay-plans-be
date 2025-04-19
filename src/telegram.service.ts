import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { Telegraf, Markup, Context } from 'telegraf';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

// Our database entities
import { User } from './entities/user.entity';
import { Project } from './entities/project.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { OpenAIService } from './openai.service';

// Import these from a types file for better organization
import { UserState, UserStateData } from './telegram/types/user-state.types';

// Import our handlers
import { MessageHandlers } from './telegram/handlers/message-handlers';
import { ProjectHandlers } from './telegram/handlers/project-handlers';

// Import translations
import { translate } from './telegram/utils/translations';
import { UserSearchService } from './telegram/services/user-search.service';

@Injectable()
export class TelegramService implements OnApplicationBootstrap {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);
  private userStates: Map<number, UserStateData> = new Map();

  // Declare handler instances
  private messageHandlers: MessageHandlers;
  private projectHandlers: ProjectHandlers;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly openAIService: OpenAIService,
    private readonly userSearchService: UserSearchService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
  ) {
    // First initialize ProjectHandlers
    this.projectHandlers = new ProjectHandlers(
      this.userStates,
      this.configService,
      this.userRepository,
      this.projectRepository,
    );

    // Then initialize MessageHandlers with the ProjectHandlers instance
    this.messageHandlers = new MessageHandlers(
      this.userStates,
      this.configService,
      this.openAIService,
      this.userRepository,
      this.projectRepository,
      this.timeSlotRepository,
      this.userSearchService,
      this, // Pass the TelegramService instance itself
      this.projectHandlers,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    const token = this.configService.get<string>('TG_TOKEN');
    if (!token) {
      this.logger.error('TG_TOKEN is not defined in environment variables');
      return;
    }

    this.bot = new Telegraf(token);

    // Add this session middleware to maintain state
    this.bot.use((ctx, next) => {
      // Ensure the context exists before proceeding
      if (ctx.from && ctx.from.id) {
        // Preserve the existing state if it exists
        if (!this.userStates.has(ctx.from.id)) {
          this.userStates.set(ctx.from.id, { state: UserState.INITIAL });
        }
      }
      return next();
    });

    // Start command handler
    this.bot.start(async (ctx) => {
      await this.handleStartCommand(ctx);
    });

    // Handle selection of language
    this.bot.action(/language:(.+)/, async (ctx) => {
      const match = ctx.match;
      const language = match[1];
      await ctx.answerCbQuery();
      await this.handleLanguageSelection(ctx, language);
    });

    // Handle selection of existing project
    this.bot.action(/project:(.+)/, async (ctx) => {
      const match = ctx.match;
      const projectId = parseInt(match[1], 10);
      await ctx.answerCbQuery();
      await this.projectHandlers.handleProjectSelection(ctx, projectId);
    });

    // Handle create new project button
    this.bot.action('create_new_project', (ctx) => {
      const webAppUrl =
        this.configService.get<string>('WEBAPP_URL') + '/new-project';
      return ctx.answerCbQuery('Opening create project page', {
        url: webAppUrl,
      });
    });

    // Handle open mini-app button
    this.bot.action('open_mini_app', (ctx) => {
      const webAppUrl = this.configService.get<string>('WEBAPP_URL');
      return ctx.answerCbQuery('Opening mini app', {
        url: webAppUrl,
      });
    });

    // Handle edit timeslots button
    this.bot.action('edit_timeslots', async (ctx) => {
      await ctx.answerCbQuery();
      await this.projectHandlers.handleEditTimeslots(ctx);
    });

    // Handle back button
    this.bot.action('back_to_projects', async (ctx) => {
      await ctx.answerCbQuery();
      await this.projectHandlers.showProjectList(ctx);
    });

    // Handle text and voice messages in project conversations
    this.bot.on('text', async (ctx) => {
      await this.messageHandlers.handleUserMessage(ctx);
    });

    this.bot.on('voice', async (ctx) => {
      await this.messageHandlers.handleVoiceMessage(ctx);
    });

    // Add a handler for the Cancel button in message processing
    this.bot.action(/cancel:(\d+)/, async (ctx) => {
      const match = ctx.match;
      const projectId = parseInt(match[1], 10);
      await ctx.answerCbQuery('Cancelled');
      await this.projectHandlers.handleProjectSelection(ctx, projectId);
    });

    // Add handlers for approve/reject time slots buttons
    this.bot.action(/approve_all:(.+)/, async (ctx) => {
      const match = ctx.match;
      const messageText = match[1];
      await ctx.answerCbQuery('Processing...');
      await this.messageHandlers.handleApproveTimeSlots(ctx, messageText);
    });

    this.bot.action(/reject_all:(.+)/, async (ctx) => {
      const match = ctx.match;
      const messageText = match[1];
      await ctx.answerCbQuery('Rejected');
      await this.messageHandlers.handleRejectTimeSlots(ctx, messageText);
    });

    // Add handler for approve and lock time slots
    this.bot.action(/approve_lock:(.+)/, async (ctx) => {
      const match = ctx.match;
      const messageText = match[1];
      await ctx.answerCbQuery('Processing...');
      await this.messageHandlers.handleApproveAndLockTimeSlots(
        ctx,
        messageText,
      );
    });

    // Backwards compatibility with older button formats
    this.bot.action(/approve_slots:(.+)/, async (ctx) => {
      const match = ctx.match;
      const timeSlotKey = match[1];
      await ctx.answerCbQuery('Processing...');
      await this.messageHandlers.handleApproveTimeSlots(ctx, timeSlotKey);
    });

    this.bot.action(/reject_slots:(.+)/, async (ctx) => {
      const match = ctx.match;
      const timeSlotKey = match[1];
      await ctx.answerCbQuery('Rejected');
      await this.messageHandlers.handleRejectTimeSlots(ctx, timeSlotKey);
    });

    // Handle time slot locking/unlocking
    this.bot.action(/lock_timeslot:(\d+)/, async (ctx) => {
      const match = ctx.match;
      const timeSlotId = parseInt(match[1], 10);
      await ctx.answerCbQuery('Processing...');
      // Additional logic to lock time slot would be implemented
      const timeSlot = await this.timeSlotRepository.findOne({
        where: { id: timeSlotId },
        relations: ['createdBy'],
      });

      if (timeSlot) {
        const tgUser = ctx.from;
        if (!tgUser) return;

        // Get the user
        const user = await this.userRepository.findOne({
          where: { telegramId: tgUser.id },
        });

        if (!user) return;

        // Only allow the creator or admin to lock/unlock
        if (timeSlot.createdBy && timeSlot.createdBy.id === user.id) {
          timeSlot.isLocked = true;
          await this.timeSlotRepository.save(timeSlot);
          await ctx.editMessageText(
            translate(user.language || 'en', 'slotIsLocked'),
            Markup.inlineKeyboard([
              Markup.button.callback(
                translate(user.language || 'en', 'unlockTimeSlot'),
                `unlock_timeslot:${timeSlot.id}`,
              ),
            ]),
          );
        } else {
          await ctx.reply(
            translate(user.language || 'en', 'cannotEditLockedSlot'),
          );
        }
      }
    });

    this.bot.action(/unlock_timeslot:(\d+)/, async (ctx) => {
      const match = ctx.match;
      const timeSlotId = parseInt(match[1], 10);
      await ctx.answerCbQuery('Processing...');
      // Additional logic to unlock time slot would be implemented
      const timeSlot = await this.timeSlotRepository.findOne({
        where: { id: timeSlotId },
        relations: ['createdBy'],
      });

      if (timeSlot) {
        const tgUser = ctx.from;
        if (!tgUser) return;

        // Get the user
        const user = await this.userRepository.findOne({
          where: { telegramId: tgUser.id },
        });

        if (!user) return;

        // Only allow the creator to unlock
        if (timeSlot.createdBy && timeSlot.createdBy.id === user.id) {
          timeSlot.isLocked = false;
          await this.timeSlotRepository.save(timeSlot);
          await ctx.editMessageText(
            translate(user.language || 'en', 'slotIsUnlocked'),
            Markup.inlineKeyboard([
              Markup.button.callback(
                translate(user.language || 'en', 'lockTimeSlot'),
                `lock_timeslot:${timeSlot.id}`,
              ),
            ]),
          );
        } else {
          await ctx.reply(
            translate(user.language || 'en', 'cannotEditLockedSlot'),
          );
        }
      }
    });

    // Handle callback queries that weren't caught by other handlers
    this.bot.on('callback_query', async (ctx) => {
      await ctx.answerCbQuery('Unknown action');
    });

    // Error handler
    this.bot.catch((err, ctx) => {
      this.logger.error(`Error for ${ctx.updateType}`, err);
      ctx.reply(
        'An error occurred while processing your request. Please try again later.',
      );
    });

    // Start the bot
    await this.bot.launch();
    this.logger.log('Telegram bot started successfully!');

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  private async handleStartCommand(ctx: Context): Promise<void> {
    const tgUser = ctx.from;
    if (!tgUser) return;

    // Find or create user
    let user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    const isFirstTime = !user;

    if (!user) {
      user = this.userRepository.create({
        telegramId: tgUser.id,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
      });
      await this.userRepository.save(user);
    }

    // Set initial state
    this.userStates.set(tgUser.id, { state: UserState.INITIAL });

    if (isFirstTime) {
      // Send greeting message for first-time users with language selection
      await ctx.reply(
        translate(user.language || 'en', 'welcomeMessage'),
        Markup.inlineKeyboard([
          Markup.button.callback('English 🇬🇧', 'language:en'),
          Markup.button.callback('Français 🇫🇷', 'language:fr'),
          Markup.button.callback('Русский 🇷🇺', 'language:ru'),
        ]),
      );
    } else {
      // For returning users, go directly to project selection
      await this.projectHandlers.showProjectList(ctx);
    }
  }

  private async handleLanguageSelection(
    ctx: Context,
    language: string,
  ): Promise<void> {
    const tgUser = ctx.from;
    if (!tgUser) return;

    const user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    if (user) {
      user.language = language;
      await this.userRepository.save(user);
    }

    await ctx.editMessageText(translate(language, 'languageSet'));
    await this.projectHandlers.showProjectList(ctx);
  }
}
