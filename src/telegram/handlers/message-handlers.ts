import { Context, Markup } from 'telegraf';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Project } from '../../entities/project.entity';
import { TimeSlot } from '../../entities/time-slot.entity';
import { User } from '../../entities/user.entity';
import { OpenAIService } from '../../openai.service';
import { UserState, UserStateData } from '../types/user-state.types';
import { Logger } from '@nestjs/common';
import { translate } from '../utils/translations';
import { TelegramService } from '../../telegram.service';
import { ProjectHandlers } from '../handlers/project-handlers';
import { TimeslotToolService } from '../../timeslot-tool.service';

/**
 * Handlers for processing user messages and time slot management
 */
export class MessageHandlers {
  private readonly logger = new Logger(MessageHandlers.name);

  constructor(
    private readonly userStateMap: Map<number, UserStateData>,
    private readonly configService: ConfigService,
    private readonly openAIService: OpenAIService,
    private readonly userRepository: Repository<User>,
    private readonly projectRepository: Repository<Project>,
    private readonly timeSlotRepository: Repository<TimeSlot>,
    private readonly telegramService: TelegramService,
    private readonly projectHandlers: ProjectHandlers,
    private readonly timeslotToolService: TimeslotToolService,
  ) {}

  /**
   * Handle the create time slots for user callback
   */
  async handleCreateForUser(ctx: Context, userId: number): Promise<void> {
    const tgUser = ctx.from;
    if (!tgUser) return;

    // Get user language preference
    const user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    const language = user?.language || 'en';

    // Get user state
    const userState = this.userStateMap.get(tgUser.id) || {
      state: UserState.INITIAL,
    };

    if (
      userState.state !== UserState.IN_PROJECT ||
      !('currentProjectId' in userState && userState.currentProjectId)
    ) {
      await this.projectHandlers.showProjectList(ctx);
      return;
    }

    // Get the selected user
    const targetUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!targetUser) {
      await ctx.reply(translate(language, 'userNotFound'));
      return;
    }

    // Store the selected user in state
    this.userStateMap.set(tgUser.id, {
      ...userState,
      selectedUserId: userId,
    });

    // Create a message explaining how to create time slots for this user
    const userName =
      targetUser.firstName ||
      targetUser.username ||
      targetUser.telegramId.toString();
    const message = translate(
      language,
      'createTimeslotsInstructions',
      userName,
    );

    await ctx.editMessageText(
      message,
      Markup.inlineKeyboard([
        Markup.button.callback(
          translate(language, 'backToProject'),
          `project:${userState.currentProjectId}`,
        ),
      ]),
    );
  }

  /**
   * Handle user text messages
   */
  async handleUserMessage(ctx: Context): Promise<void> {
    if (!ctx.message || !('text' in ctx.message) || !ctx.message.text) {
      return;
    }

    const message = ctx.message.text;
    const tgUser = ctx.from;
    if (!tgUser) return;

    // Get user and language preference
    const user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    if (!user) return;
    const language = user.language || 'en';

    // Get user state data
    const userState = this.userStateMap.get(tgUser.id) || {
      state: UserState.INITIAL,
    };

    // Check if user is in a project
    if (
      userState.state !== UserState.IN_PROJECT ||
      !userState.currentProjectId
    ) {
      await this.projectHandlers.showProjectList(ctx);
      return;
    }

    // Show typing... indicator
    await ctx.sendChatAction('typing');

    // Set user state to processing message
    this.userStateMap.set(tgUser.id, {
      ...userState,
      state: UserState.PROCESSING_MESSAGE,
    });

    this.logger.log(`Processing message: ${message}`);

    try {
      // Get all project users for AI processing
      const project = await this.projectRepository.findOne({
        where: { id: userState.currentProjectId },
      });

      if (!project) {
        await ctx.reply(translate(language, 'projectNotFound'));
        return;
      }

      const projectUsers =
        project.users?.map((user) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
        })) || [];

      // Process the message with enhanced AI capabilities
      const result = await this.openAIService.processMessage(
        message,
        user,
        project,
        `project-${userState.currentProjectId}`,
        projectUsers,
      );

      // Send the response back to the user
      // Check if there was a successful tool call
      if (
        result.toolCallSuccess &&
        'chat' in ctx &&
        ctx.chat &&
        ctx.message.message_id
      ) {
        await this.telegramService.setMessageReaction(
          ctx.chat.id,
          ctx.message.message_id,
          '👍',
        );
      } else {
        await ctx.reply(
          result.text || translate(language, 'errorProcessingMessage'),
        );
      }

      // Reset user state
      this.userStateMap.set(tgUser.id, {
        ...userState,
        state: UserState.IN_PROJECT,
      });
    } catch (error) {
      this.logger.error(`Error processing message: ${error}`);
      await ctx.reply(translate(language, 'errorProcessingMessage'));

      // Reset user state on error
      this.userStateMap.set(tgUser.id, {
        ...userState,
        state: UserState.IN_PROJECT,
      });
    }
  }

  /**
   * Handle voice messages
   */
  async handleVoiceMessage(ctx: Context): Promise<void> {
    const tgUser = ctx.from;
    if (!tgUser) return;

    // Use type checking to safely access the voice property
    const voice =
      ctx.message && 'voice' in ctx.message ? ctx.message.voice : null;
    if (!voice) return;

    // Get user language preference
    const user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    if (!user) return;
    const language = user.language || 'en';

    const userState = this.userStateMap.get(tgUser.id) || {
      state: UserState.INITIAL,
    };

    // Only process messages when user is in a project
    if (
      userState.state !== UserState.IN_PROJECT ||
      !('currentProjectId' in userState && userState.currentProjectId)
    ) {
      await this.projectHandlers.showProjectList(ctx);
      return;
    }

    // Show typing indicator
    await ctx.sendChatAction('typing');

    // Set user state to processing message
    this.userStateMap.set(tgUser.id, {
      ...userState,
      state: UserState.PROCESSING_MESSAGE,
    });

    try {
      // Get voice file from Telegram
      const link = await ctx.telegram.getFileLink(voice.file_id);

      // Download the file using fetch instead of axios
      const response = await fetch(link.href);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Generate a filename
      const filename = `voice_${tgUser.id}_${Date.now()}.ogg`;

      // Transcribe the audio
      const transcription = await this.openAIService.transcribeAudio(
        buffer,
        filename,
      );

      if (!transcription) {
        await ctx.reply(translate(language, 'cannotTranscribe'));
        // Reset user state
        this.userStateMap.set(tgUser.id, {
          ...userState,
          state: UserState.IN_PROJECT,
        });
        return;
      }

      // // Log the transcription for debugging
      // this.logger.log(`Voice transcription: ${transcription}`);

      // // Send transcription info to user
      // await ctx.reply(translate(language, 'transcriptionHeard', transcription));

      // Process the transcription exactly like a text message

      // Get all project users for AI processing
      const project = await this.projectRepository.findOne({
        where: { id: userState.currentProjectId },
      });

      if (!project) {
        await ctx.reply(translate(language, 'projectNotFound'));
        // Reset user state
        this.userStateMap.set(tgUser.id, {
          ...userState,
          state: UserState.IN_PROJECT,
        });
        return;
      }

      const projectUsers =
        project.users?.map((user) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
        })) || [];

      // Process the transcribed message with enhanced AI capabilities
      const result = await this.openAIService.processMessage(
        transcription,
        user,
        project,
        `project-${userState.currentProjectId}`,
        projectUsers,
      );

      // Send the response back to the user
      // Check if there was a successful tool call
      if (
        result.toolCallSuccess &&
        'chat' in ctx &&
        ctx.chat &&
        ctx.message.message_id
      ) {
        await this.telegramService.setMessageReaction(
          ctx.chat.id,
          ctx.message.message_id,
          '👍',
        );
      } else {
        await ctx.reply(
          result.text || translate(language, 'errorProcessingMessage'),
        );
      }

      // Reset user state
      this.userStateMap.set(tgUser.id, {
        ...userState,
        state: UserState.IN_PROJECT,
      });
    } catch (error) {
      this.logger.error(
        `Error processing voice message: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );

      // Reset user state on error
      this.userStateMap.set(tgUser.id, {
        ...userState,
        state: UserState.IN_PROJECT,
      });

      await ctx.reply(translate(language, 'errorProcessingVoice'));
    }
  }
}
