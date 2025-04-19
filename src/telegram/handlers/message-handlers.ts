import { Context, Markup } from 'telegraf';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Project } from '../../entities/project.entity';
import { TimeSlot } from '../../entities/time-slot.entity';
import { User } from '../../entities/user.entity';
import { OpenAIService } from '../../openai.service';
import {
  TimeSlotData,
  UserState,
  UserStateData,
} from '../types/user-state.types';
import { Logger } from '@nestjs/common';
import { translate } from '../utils/translations';
import { UserSearchService } from '../services/user-search.service';
import { TelegramService } from '../../telegram.service';
import { ProjectHandlers } from '../handlers/project-handlers';

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
    private readonly userSearchService: UserSearchService,
    private readonly telegramService: TelegramService,
    private readonly projectHandlers: ProjectHandlers,
  ) {}

  /**
   * Handle user search command
   * Allows searching users within a project using free-form text
   * Format: /find [search query]
   */
  async handleUserSearchCommand(
    ctx: Context,
    searchQuery: string,
  ): Promise<void> {
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

    // Only process search when user is in a project
    if (
      userState.state !== UserState.IN_PROJECT ||
      !('currentProjectId' in userState && userState.currentProjectId)
    ) {
      await ctx.reply(translate(language, 'selectProject'));
      return;
    }

    const projectId = userState.currentProjectId;

    if (!searchQuery || searchQuery.trim() === '') {
      await ctx.reply(translate(language, 'userSearchHelp'));
      return;
    }

    try {
      // Show typing indicator while processing
      if ('chat' in ctx && ctx.chat) {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      }

      // Search for users matching the query
      const searchResults = await this.userSearchService.searchUsersInProject(
        projectId,
        searchQuery,
      );

      if (searchResults.users.length === 0) {
        await ctx.reply(translate(language, 'noUsersFound', searchQuery));
        return;
      }

      let responseMessage = translate(
        language,
        'usersFoundTitle',
        searchResults.users.length.toString(),
        searchQuery,
      );

      // Format user list
      const userList = searchResults.users
        .map((foundUser) => {
          const name =
            foundUser.firstName ||
            foundUser.username ||
            foundUser.telegramId.toString();

          // Check if this was an AI match
          const aiMatch = searchResults.aiMatches.find(
            (match) => match.user.id === foundUser.id,
          );

          // If it's an AI match with high confidence and has reasoning, show it
          if (aiMatch && aiMatch.confidence > 0.6 && aiMatch.reasoning) {
            return `👤 ${name}${foundUser.lastName ? ' ' + foundUser.lastName : ''} - ${aiMatch.reasoning}`;
          }

          return `👤 ${name}${foundUser.lastName ? ' ' + foundUser.lastName : ''}`;
        })
        .join('\n');

      responseMessage += '\n\n' + userList;

      // Add buttons for creating time slots
      const buttons = searchResults.users.map((foundUser) => {
        const name =
          foundUser.firstName ||
          foundUser.username ||
          foundUser.telegramId.toString();
        return Markup.button.callback(
          translate(language, 'createTimeslotsFor', name),
          `create_for:${foundUser.id}`,
        );
      });

      // Add a button to go back to project
      buttons.push(
        Markup.button.callback(
          translate(language, 'backToProject'),
          `project:${projectId}`,
        ),
      );

      await ctx.reply(
        responseMessage,
        Markup.inlineKeyboard(buttons, { columns: 1 }),
      );
    } catch (error) {
      this.logger.error(
        `Error searching users: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );
      await ctx.reply(translate(language, 'errorSearchingUsers'));
    }
  }

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
      await ctx.reply(translate(language, 'selectProject'));
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

    // Check for user search command
    if (message.startsWith('/find') || message.startsWith('/search')) {
      const searchQuery = message.split(' ').slice(1).join(' ').trim();
      await this.handleUserSearchCommand(ctx, searchQuery);
      return;
    }

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
      await ctx.reply(translate(language, 'selectProject'));
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
      // Check if message mentions other users
      const { mentionedUser, cleanMessage } = await this.extractMentionedUser(
        ctx,
        message,
      );

      // Try to handle this as a slot status change request
      if ('chat' in ctx && ctx.chat) {
        const isSlotStatusChangeRequest =
          await this.handleSlotStatusChangeRequest(
            ctx.chat.id,
            cleanMessage,
            tgUser.id,
          );

        if (isSlotStatusChangeRequest) {
          await ctx.reply(translate(language, 'slotTypeChanged'));
          return;
        }
      }

      // If no direct mention, but we have a selected user from a previous command
      let participantUser = mentionedUser;
      if (!participantUser && userState.selectedUserId) {
        const foundUser = await this.userRepository.findOne({
          where: { id: userState.selectedUserId as number },
        });
        // Use the type guard to safely assign the user
        if (foundUser && this.isUser(foundUser)) {
          participantUser = foundUser;
        }
      }

      // Get the user's existing time slots for this project
      const timeSlots = await this.timeSlotRepository.find({
        where: {
          user: { id: user.id },
          project: { id: userState.currentProjectId },
        },
      });

      // Process the message to extract time slots, passing existing slots
      const result = await this.openAIService.processMessage(
        cleanMessage,
        userState.currentProjectId,
        timeSlots as any, // Type cast to resolve incompatibility
      );

      const newTimeSlots = result.timeslots || [];

      if (!newTimeSlots || newTimeSlots.length === 0) {
        await ctx.reply(
          result.text || translate(language, 'noTimeSlotsIdentified'),
        );
        return;
      }

      // Store time slots in user state
      const pendingTimeSlots = userState.pendingTimeSlots || {};
      this.userStateMap.set(tgUser.id, {
        ...userState,
        pendingTimeSlots: {
          ...pendingTimeSlots,
          [message]: newTimeSlots,
        },
        // Store mentioned user with this message
        mentionedUsers: {
          ...(userState.mentionedUsers || {}),
          [message]: participantUser ? participantUser.id : null,
        },
      });

      // Count available and busy slots
      const availableSlots = newTimeSlots.filter(
        (slot: TimeSlotData) => slot.status === 'available' || !slot.status,
      );
      const busySlots = newTimeSlots.filter(
        (slot: TimeSlotData) => slot.status === 'busy',
      );

      // Format time slots for display with status indicators
      const formattedTimeSlots = newTimeSlots
        .map((slot: TimeSlotData, index: number) => {
          const statusEmoji = slot.status === 'busy' ? '❌' : '✅';
          const statusText =
            slot.status === 'busy'
              ? translate(language, 'busySlot')
              : translate(language, 'availableSlot');
          return `${index + 1}. ${statusEmoji} ${statusText}: ${new Date(slot.startTime).toLocaleString()} - ${new Date(
            slot.endTime,
          ).toLocaleString()}${slot.notes ? ` (${slot.notes})` : ''}`;
        })
        .join('\n');

      // Create a message based on the types of slots detected
      let responseMessage = '';

      // If the model returned a conversational response, include it first
      if (result.text && result.text.trim()) {
        responseMessage = result.text.trim() + '\n\n';
      }

      // If this is for another participant, indicate that in the response
      if (participantUser) {
        responseMessage += `${translate(language, 'creatingFor')} ${participantUser.firstName || participantUser.username || 'another user'}:\n\n`;
      }

      if (availableSlots.length > 0 && busySlots.length > 0) {
        responseMessage += translate(
          language,
          'foundBothTypes',
          formattedTimeSlots,
        );
        if (busySlots.length > 0) {
          responseMessage += translate(
            language,
            'busySlotNote',
            busySlots.length.toString(),
          );
        }
        responseMessage += translate(
          language,
          'addAvailableSlots',
          availableSlots.length.toString(),
        );
      } else if (availableSlots.length > 0) {
        responseMessage += translate(
          language,
          'foundAvailableSlots',
          formattedTimeSlots,
        );
      } else if (busySlots.length > 0) {
        responseMessage += translate(
          language,
          'foundBusySlots',
          formattedTimeSlots,
        );
      }

      // Add option to lock slots if creating for self
      const buttons = [
        Markup.button.callback(
          translate(language, 'approveAll'),
          `approve_all:${message}`,
        ),
        Markup.button.callback(
          translate(language, 'rejectAll'),
          `reject_all:${message}`,
        ),
      ];

      // Only show lock option when creating for self
      if (!participantUser) {
        buttons.push(
          Markup.button.callback(
            translate(language, 'approveAndLock'),
            `approve_lock:${message}`,
          ),
        );
      }

      // Generate buttons for approving/rejecting time slots
      await ctx.reply(
        responseMessage,
        Markup.inlineKeyboard(buttons, { columns: 2 }),
      );

      // Clear the selected user after processing the message
      if (userState.selectedUserId) {
        const updatedState = { ...userState };
        delete updatedState.selectedUserId;
        this.userStateMap.set(tgUser.id, updatedState);
      }
    } catch (error) {
      this.logger.error(
        `Error processing message: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );

      // Make sure we set the state back to IN_PROJECT and keep the currentProjectId
      if (userState && userState.currentProjectId) {
        this.userStateMap.set(tgUser.id, {
          ...userState,
          state: UserState.IN_PROJECT,
        });
      }

      await ctx.reply(translate(language, 'errorProcessingMessage'));
    }
  }

  /**
   * Extract mentioned user from message
   * Returns the user mentioned in the message and cleans the message of mentions
   */
  private async extractMentionedUser(
    ctx: Context,
    message: string,
  ): Promise<{
    mentionedUser: User | null;
    cleanMessage: string;
  }> {
    try {
      // Check for mentioned users in the format "@username" or via Telegram mention entities
      let mentionedUsername = '';
      let mentionedUserId = null;
      let cleanMessage = message;

      // Extract mentions from message entities if available
      if (ctx.message && 'entities' in ctx.message && ctx.message.entities) {
        // Find mention entities
        const mentionEntities = ctx.message.entities.filter(
          (entity) =>
            entity.type === 'mention' || entity.type === 'text_mention',
        );

        if (mentionEntities.length > 0) {
          const entity = mentionEntities[0]; // Take the first mention for now

          if (entity.type === 'mention') {
            // This is a username mention (@username)
            mentionedUsername = message.substring(
              entity.offset + 1,
              entity.offset + entity.length,
            );
          } else if (entity.type === 'text_mention' && entity.user) {
            // This is a text mention with user data
            mentionedUserId = entity.user.id;
          }

          // Remove mention from message for better processing
          cleanMessage = message
            .replace(
              message.substring(entity.offset, entity.offset + entity.length),
              '',
            )
            .trim();
        }
      } else {
        // Fallback: check for @username format manually
        const mentionMatch = message.match(/@(\w+)/);
        if (mentionMatch) {
          mentionedUsername = mentionMatch[1];
          // Remove mention from message
          cleanMessage = message.replace(mentionMatch[0], '').trim();
        }
      }

      // Find user by username or Telegram ID
      let mentionedUser: User | null = null;
      if (mentionedUserId) {
        const foundMentionedUser = await this.userRepository.findOne({
          where: { telegramId: mentionedUserId as number },
        });
        mentionedUser = foundMentionedUser ? foundMentionedUser : null;
      } else if (mentionedUsername) {
        const foundMentionedUser = await this.userRepository.findOne({
          where: { username: mentionedUsername },
        });
        mentionedUser = foundMentionedUser ? foundMentionedUser : null;
      }

      return { mentionedUser, cleanMessage };
    } catch (error) {
      this.logger.error(
        `Error extracting mentioned user: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );
      return { mentionedUser: null, cleanMessage: message };
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
    const language = user?.language || 'en';

    const userState = this.userStateMap.get(tgUser.id) || {
      state: UserState.INITIAL,
    };

    // Only process messages when user is in a project
    if (
      userState.state !== UserState.IN_PROJECT ||
      !('currentProjectId' in userState && userState.currentProjectId)
    ) {
      await ctx.reply(translate(language, 'selectProject'));
      return;
    }

    // Show typing indicator
    await ctx.sendChatAction('typing');

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
        return;
      }

      await ctx.reply(translate(language, 'transcriptionHeard', transcription));

      // Check if transcription mentions other users
      const { mentionedUser, cleanMessage } = await this.extractMentionedUser(
        ctx,
        transcription,
      );

      // Get the user's existing time slots for this project
      const timeSlots = await this.timeSlotRepository.find({
        where: {
          user: { id: user.id },
          project: { id: userState.currentProjectId },
        },
      });

      // Try to handle this as a slot status change request
      if ('chat' in ctx && ctx.chat) {
        const isSlotStatusChangeRequest =
          await this.handleSlotStatusChangeRequest(
            ctx.chat.id,
            cleanMessage,
            tgUser.id,
          );

        if (isSlotStatusChangeRequest) {
          await ctx.reply(translate(language, 'slotTypeChanged'));
          return;
        }
      }

      // Process the transcription as a text message, passing existing slots
      if (cleanMessage && userState.currentProjectId) {
        const result = await this.openAIService.processMessage(
          cleanMessage,
          userState.currentProjectId,
          timeSlots as any, // Type cast to resolve incompatibility
        );

        const newTimeSlots = result.timeslots || [];

        // If no new time slots were detected, just return the conversation response
        if (!newTimeSlots || newTimeSlots.length === 0) {
          await ctx.reply(
            result.text || translate(language, 'noTimeSlotsIdentified'),
          );
          return;
        }

        // Store time slots in user state
        const pendingTimeSlots = userState.pendingTimeSlots || {};
        this.userStateMap.set(tgUser.id, {
          ...userState,
          pendingTimeSlots: {
            ...pendingTimeSlots,
            [transcription]: newTimeSlots,
          },
          // Store mentioned user with this message
          mentionedUsers: {
            ...(userState.mentionedUsers || {}),
            [transcription]: mentionedUser ? mentionedUser.id : null,
          },
        });

        // Count available and busy slots
        const availableSlots = newTimeSlots.filter(
          (slot: TimeSlotData) => slot.status === 'available' || !slot.status,
        );
        const busySlots = newTimeSlots.filter(
          (slot: TimeSlotData) => slot.status === 'busy',
        );

        // Format time slots for display with status indicators
        const formattedTimeSlots = newTimeSlots
          .map((slot: TimeSlotData, index: number) => {
            const statusEmoji = slot.status === 'busy' ? '❌' : '✅';
            const statusText =
              slot.status === 'busy'
                ? translate(language, 'busySlot')
                : translate(language, 'availableSlot');
            return `${index + 1}. ${statusEmoji} ${statusText}: ${new Date(slot.startTime).toLocaleString()} - ${new Date(
              slot.endTime,
            ).toLocaleString()}${slot.notes ? ` (${slot.notes})` : ''}`;
          })
          .join('\n');

        // Create a message based on the types of slots detected
        let responseMessage = '';

        // If the model returned a conversational response, include it first
        if (result.text && result.text.trim()) {
          responseMessage = result.text.trim() + '\n\n';
        }

        // If this is for another participant, indicate that in the response
        if (mentionedUser) {
          responseMessage += `${translate(language, 'creatingFor')} ${mentionedUser.firstName || mentionedUser.username || 'another user'}:\n\n`;
        }

        if (availableSlots.length > 0 && busySlots.length > 0) {
          responseMessage += translate(
            language,
            'foundBothTypes',
            formattedTimeSlots,
          );
          if (busySlots.length > 0) {
            responseMessage += translate(
              language,
              'busySlotNote',
              busySlots.length.toString(),
            );
          }
          responseMessage += translate(
            language,
            'addAvailableSlots',
            availableSlots.length.toString(),
          );
        } else if (availableSlots.length > 0) {
          responseMessage += translate(
            language,
            'foundAvailableSlots',
            formattedTimeSlots,
          );
        } else if (busySlots.length > 0) {
          responseMessage += translate(
            language,
            'foundBusySlots',
            formattedTimeSlots,
          );
        }

        // Add option to lock slots if creating for self
        const buttons = [
          Markup.button.callback(
            translate(language, 'approveAll'),
            `approve_all:${transcription}`,
          ),
          Markup.button.callback(
            translate(language, 'rejectAll'),
            `reject_all:${transcription}`,
          ),
        ];

        // Only show lock option when creating for self
        if (!mentionedUser) {
          buttons.push(
            Markup.button.callback(
              translate(language, 'approveAndLock'),
              `approve_lock:${transcription}`,
            ),
          );
        }

        // Generate buttons for approving/rejecting time slots
        await ctx.reply(
          responseMessage,
          Markup.inlineKeyboard(buttons, { columns: 2 }),
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing voice message: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );

      // Make sure we set the state back to IN_PROJECT and keep the currentProjectId
      if (userState && userState.currentProjectId) {
        this.userStateMap.set(tgUser.id, {
          ...userState,
          state: UserState.IN_PROJECT,
        });
      }

      await ctx.reply(translate(language, 'errorProcessingVoice'));
    }
  }

  /**
   * Type guard to check if an object is a User
   */
  private isUser(obj: any): obj is User {
    return obj && typeof obj === 'object' && 'id' in obj && 'telegramId' in obj;
  }

  /**
   * Handle approval of time slots
   */
  async handleApproveTimeSlots(
    ctx: Context,
    messageText: string,
    shouldLock = false,
  ): Promise<void> {
    const tgUser = ctx.from;
    if (!tgUser) return;

    // Get user language preference
    const user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    const language = user?.language || 'en';

    const userState = this.userStateMap.get(tgUser.id);
    if (
      !userState ||
      !('currentProjectId' in userState && userState.currentProjectId) ||
      !('pendingTimeSlots' in userState && userState.pendingTimeSlots)
    ) {
      await ctx.reply(translate(language, 'noTimeSlotApprove'));
      return;
    }

    const timeSlots = userState.pendingTimeSlots[messageText];
    if (!timeSlots || timeSlots.length === 0) {
      await ctx.reply(translate(language, 'noTimeSlotApprove'));
      return;
    }

    // Check if this is for another user
    const participantId = userState.mentionedUsers?.[messageText];
    let participantUser = null;
    if (participantId) {
      participantUser = await this.userRepository.findOne({
        where: { id: participantId },
      });
    }

    try {
      // Show typing indicator while processing
      if ('chat' in ctx && ctx.chat) {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      }

      // Get project and user
      const project = await this.projectRepository.findOne({
        where: { id: userState.currentProjectId },
      });

      if (!project || !user) {
        await ctx.reply(translate(language, 'projectOrUserNotFound'));
        return;
      }

      // Save time slots to database
      const savedTimeSlots = await Promise.all(
        timeSlots.map(async (timeSlotData: TimeSlotData) => {
          // Create safe user references
          const safeUser = this.isUser(user) ? user : null;
          const safeParticipant = this.isUser(participantUser)
            ? participantUser
            : null;

          // Only proceed if we have a valid user
          if (!safeUser) {
            throw new Error('Invalid user reference');
          }

          const timeSlot = {
            startTime: new Date(timeSlotData.startTime),
            endTime: new Date(timeSlotData.endTime),
            notes: timeSlotData.notes || '',
            status: timeSlotData.status || 'available',
            project,
            user: safeParticipant || safeUser,
            createdBy: safeUser,
            participantFor: safeParticipant || safeUser,
            isLocked: shouldLock,
          };
          const timeSlotEntity = this.timeSlotRepository.create(timeSlot);
          return this.timeSlotRepository.save(timeSlotEntity);
        }),
      );

      // Remove pending time slots
      const updatedPendingTimeSlots = { ...userState.pendingTimeSlots };
      delete updatedPendingTimeSlots[messageText];

      // Also clean up mentioned users
      const updatedMentionedUsers = { ...(userState.mentionedUsers || {}) };
      delete updatedMentionedUsers[messageText];

      this.userStateMap.set(tgUser.id, {
        ...userState,
        pendingTimeSlots: updatedPendingTimeSlots,
        mentionedUsers: updatedMentionedUsers,
      });

      // Prepare response message
      let responseMessage;
      if (shouldLock) {
        responseMessage = translate(
          language,
          'slotsAddedAndLocked',
          savedTimeSlots.length.toString(),
        );
      } else if (participantUser) {
        let participantName = 'another user';
        if (this.isUser(participantUser)) {
          participantName =
            participantUser.firstName ||
            participantUser.username ||
            'another user';
        }
        responseMessage = translate(
          language,
          'slotsAddedForUser',
          savedTimeSlots.length.toString(),
          String(participantName),
        );
        // Add note about changing slot types
        responseMessage +=
          '\n\n' +
          translate(language, 'changeSlotType') +
          ': ' +
          translate(language, 'viewProject');
      } else {
        responseMessage = translate(
          language,
          'slotsAddedSuccess',
          savedTimeSlots.length.toString(),
        );
      }

      // Update the original message instead of sending a new one
      if (
        'callback_query' in ctx.update &&
        ctx.update.callback_query &&
        ctx.update.callback_query.message
      ) {
        await ctx.editMessageText(
          responseMessage as string,
          Markup.inlineKeyboard([
            Markup.button.callback(
              translate(language, 'viewProject'),
              `project:${userState.currentProjectId}`,
            ),
          ]),
        );
      } else {
        // Fallback in case we can't access the original message
        await ctx.reply(
          responseMessage as string,
          Markup.inlineKeyboard([
            Markup.button.callback(
              translate(language, 'viewProject'),
              `project:${userState.currentProjectId}`,
            ),
          ]),
        );
      }
    } catch (error) {
      this.logger.error(
        `Error approving time slots: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );

      // Make sure we set the state back to IN_PROJECT and keep the currentProjectId
      if (userState && userState.currentProjectId) {
        this.userStateMap.set(tgUser.id, {
          ...userState,
          state: UserState.IN_PROJECT,
        });
      }

      await ctx.reply(translate(language, 'errorAddingTimeSlots'));
    }
  }

  /**
   * Handle approval and locking of time slots
   */
  async handleApproveAndLockTimeSlots(
    ctx: Context,
    messageText: string,
  ): Promise<void> {
    return this.handleApproveTimeSlots(ctx, messageText, true);
  }

  /**
   * Handle rejection of time slots
   */
  async handleRejectTimeSlots(
    ctx: Context,
    messageText: string,
  ): Promise<void> {
    const tgUser = ctx.from;
    if (!tgUser) return;

    // Get user language preference
    const user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    const language = user?.language || 'en';

    const userState = this.userStateMap.get(tgUser.id);
    if (
      !userState ||
      !('pendingTimeSlots' in userState && userState.pendingTimeSlots)
    ) {
      await ctx.reply(translate(language, 'noTimeSlotApprove'));
      return;
    }

    // Remove pending time slots
    const updatedPendingTimeSlots = { ...userState.pendingTimeSlots };
    delete updatedPendingTimeSlots[messageText];

    // Also clean up mentioned users
    const updatedMentionedUsers = { ...(userState.mentionedUsers || {}) };
    delete updatedMentionedUsers[messageText];

    this.userStateMap.set(tgUser.id, {
      ...userState,
      pendingTimeSlots: updatedPendingTimeSlots,
      mentionedUsers: updatedMentionedUsers,
    });

    // Update the original message instead of sending a new one
    if (
      'callback_query' in ctx.update &&
      ctx.update.callback_query &&
      ctx.update.callback_query.message
    ) {
      await ctx.editMessageText(
        translate(language, 'slotsRejected'),
        Markup.inlineKeyboard([
          Markup.button.callback(
            translate(language, 'backToProject'),
            `project:${userState.currentProjectId}`,
          ),
        ]),
      );
    } else {
      // Fallback in case we can't access the original message
      await ctx.reply(translate(language, 'slotsRejected'));
    }
  }

  /**
   * Handle a request to change the status of a time slot
   */
  async handleSlotStatusChangeRequest(
    chatId: number,
    messageText: string,
    userId: number,
  ): Promise<boolean> {
    // Only process if user is in a project
    const userState = this.userStateMap.get(userId) || {
      state: UserState.INITIAL,
    };
    if (
      userState.state !== UserState.IN_PROJECT ||
      !userState.currentProjectId
    ) {
      return false;
    }

    const projectId = userState.currentProjectId;

    this.logger.log(
      `Attempting to change slot status for user ${userId} with message: "${messageText}"`,
    );

    // Get time slots for the user in this project
    const timeSlots = await this.timeSlotRepository.find({
      where: {
        user: { id: userId },
        project: { id: projectId },
      },
      relations: ['createdBy'],
    });

    if (!timeSlots || timeSlots.length === 0) {
      this.logger.log(
        `No time slots found for user ${userId} in project ${projectId}`,
      );
      return false;
    }

    this.logger.log(
      `Found ${timeSlots.length} time slots for analysis. IDs: ${timeSlots.map((slot) => slot.id).join(', ')}`,
    );

    try {
      // Analyze if message is a request to change slot status
      const analysis = await this.openAIService.analyzeSlotTypeChangeRequest(
        messageText,
        timeSlots,
      );

      this.logger.log(
        `Analysis result: isChangeRequest=${analysis.isChangeRequest}, confidence=${analysis.confidence}, targetStatus=${analysis.targetStatus}`,
      );
      this.logger.log(`Slots to change: ${analysis.slotsToChange.join(', ')}`);
      this.logger.log(`Reasoning: ${analysis.reasoning}`);

      if (!analysis.isChangeRequest || analysis.confidence < 0.7) {
        return false;
      }

      // Process the slot status change
      const slotsToUpdate = timeSlots.filter((slot) =>
        analysis.slotsToChange.includes(slot.id),
      );

      this.logger.log(`Found ${slotsToUpdate.length} slots to update`);

      if (slotsToUpdate.length === 0) {
        return false;
      }

      // Update the slots
      for (const slot of slotsToUpdate) {
        // Only allow changes if the slot is not locked or if the user is the creator
        if (
          !slot.isLocked ||
          (slot.createdBy && slot.createdBy.id === userId)
        ) {
          // If a target status is specified, use it; otherwise toggle the current status
          const newStatus =
            analysis.targetStatus ||
            (slot.status === 'available' ? 'busy' : 'available');

          this.logger.log(
            `Updating slot ${slot.id} from ${slot.status} to ${newStatus}`,
          );
          slot.status = newStatus;
          await this.timeSlotRepository.save(slot);
        }
      }

      // Log the status change
      this.logger.log(
        `Changed ${slotsToUpdate.length} slots for user ${userId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Error handling slot status change: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
