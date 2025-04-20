import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources';
import * as fs from 'fs';
import * as path from 'path';
import { TimeslotToolService } from './timeslot-tool.service';
import { Project } from './entities/project.entity';
import { User } from './entities/user.entity';
import { timeslotTools } from './timeslot-tools';

// Define interface for tool call results
interface TimeslotToolResult {
  success: boolean;
  timeslots?: any[];
  deletedCount?: number;
  error?: string;
  [key: string]: any;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;
  private conversationContexts: Map<string, ChatCompletionMessageParam[]> =
    new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly timeslotToolService: TimeslotToolService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async callFunction(
    toolCall: ChatCompletionMessageToolCall,
  ): Promise<TimeslotToolResult> {
    try {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments) as unknown;

      this.logger.log(
        `Calling function ${functionName} with args: ${JSON.stringify(
          functionArgs,
        )}`,
      );

      // Call the appropriate function based on the function name
      switch (functionName) {
        case 'project_add_timeslots':
          return await this.timeslotToolService.addTimeslots(
            functionArgs as any,
          );
        case 'project_update_timeslots':
          return await this.timeslotToolService.updateTimeslots(
            functionArgs as any,
          );
        case 'project_delete_timeslots':
          return await this.timeslotToolService.deleteTimeslots(
            functionArgs as any,
          );
        case 'project_merge_timeslots':
          return await this.timeslotToolService.mergeTimeslots(
            functionArgs as any,
          );
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error) {
      this.logger.error(`Error in callFunction: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timeslots: [],
        deletedCount: 0,
      };
    }
  }

  /**
   * Process text message with ChatGPT
   */
  async processMessage(
    message: string,
    user: User,
    project: Project,
    contextId: string = `project-${project.id}`,
    projectUsers: {
      id: number;
      firstName?: string;
      lastName?: string;
      username?: string;
    }[] = [],
  ): Promise<{
    text: string;
    timeslots?: any[];
    toolCallSuccess?: boolean;
  }> {
    try {
      // Get or create conversation history for this context
      const conversationHistory = this.getConversationContext(contextId);

      // Add user message to history
      conversationHistory.push({
        role: 'user',
        content: message,
      });

      // Get current date and time for context
      const currentDate = new Date();
      const dateTimeString = currentDate.toISOString();
      const localDateString = currentDate.toLocaleString();

      // Prepare user information for context if available
      const userList =
        projectUsers.length > 0
          ? projectUsers
              .map(
                (user) =>
                  `User ID: ${user.id}, Name: ${user.firstName || ''} ${user.lastName || ''}, Username: ${user.username || ''}`,
              )
              .join('\n')
          : 'No users available';

      // Get all time slots for this user in this project
      const timeSlots = await this.timeslotToolService.getUserTimeSlots(
        user.id,
        project.id,
      );

      // System message with instructions for timeslot extraction, search detection, and user mentions
      const systemMessage: ChatCompletionMessageParam = {
        role: 'system',
        content: `You are an AI assistant helping users manage their schedule in a project planning application. 
        Today's date and time is ${localDateString} (${dateTimeString}).
        
        ## About Timeslots
        Timeslots represent periods when a user is either available or busy. They have the following properties:
        - startTime: When the time period begins (ISO format date-time, always 00:00:00)
        - endTime: When the time period ends (ISO format date-time, always 23:59:59)
        - notes: Optional description of what the timeslot is for
        - status: Either "available" or "busy"
        - isLocked: When true, only the creator can modify the timeslot
        - label: Optional descriptive label for the timeslot (e.g., "Holiday", "Team Meeting")
        - color: Optional hex color code (e.g., "#FF5733") used for visual display
        
        ## Labels and Colors
        - If the user doesn't explicitly provide a label, you should ALWAYS generate a meaningful, descriptive label based on the context
        - Labels should be concise but informative (1-5 words is ideal)
        - If the user doesn't specify a color, a default color will be automatically assigned based on the user ID
        - You can suggest changes to both labels and colors if it makes sense in the context
        
        ## Project Users
        The following users are part of this project:
        ${userList}
        
        ## Current User's Time Slots
        Here are the current time slots for the user in project "${project.name}":
        ${(() => {
          // Check if all timeslots are within the same year
          const allSameYear =
            timeSlots.length > 0 &&
            timeSlots.every((slot) => {
              const startYear = new Date(slot.startTime).getFullYear();
              const endYear = new Date(slot.endTime).getFullYear();
              return (
                startYear === currentDate.getFullYear() &&
                endYear === currentDate.getFullYear()
              );
            });

          return timeSlots
            .map((slot) => {
              const startDate = new Date(slot.startTime);
              const endDate = new Date(slot.endTime);

              // Format dates based on whether they're all in the same year
              const dateOptions: Intl.DateTimeFormatOptions = allSameYear
                ? { month: 'numeric', day: 'numeric' }
                : { year: 'numeric', month: 'numeric', day: 'numeric' };

              const date = startDate.toLocaleDateString(undefined, dateOptions);
              const endDateStr = endDate.toLocaleDateString(
                undefined,
                dateOptions,
              );

              const labelInfo = slot.label ? ` [${slot.label}]` : '';
              return `- ${date}${date !== endDateStr ? ` to ${endDateStr}` : ''} (${slot.status})${labelInfo} ${slot.notes ? `"${slot.notes}"` : ''}`;
            })
            .join('\n');
        })()}
        
        ## Tools
        You can use tools to directly manipulate time slots. When a user makes a request to add, update, delete, or merge time slots, 
        use the appropriate tool rather than explaining how to do it.
        
        ## Language Adaptability
        IMPORTANT: Always respond in the same language that the user used in their message. Even though these instructions are in English, 
        you must detect the user's language and respond in that same language. This applies to all messages, including timeslot confirmations,
        error messages, and casual conversation.
        
        ## IMPORTANT: Time Interpretation Rules
        - All timeslots operate on FULL DAYS only - no hourly slots are allowed
        - When time slots are created, they should always span a complete day (from 00:00:00 to 23:59:59)
        - Create the LONGEST possible continuous intervals instead of separate slots
        - For example, if user mentions "1 to 9 May", create ONE slot spanning all 9 days, not 9 individual slots
        - When multiple consecutive days have the same status, ALWAYS consolidate them into a single slot
        - Default to the current or upcoming dates if no specific date is mentioned
        
        ## IMPORTANT: Status Determination Rules
        - The general goal is to understand when people (friends, family, etc.) are available to meet
        - Mark as "available" when:
          - Vacations, holidays, and personal time off (these indicate the person is not at work but could potentially be available for this project)
          - Any event that is consistent with the rest of the vacation plans
        - Mark as "busy" when:
          - Work commitments, meetings, deadlines
          - Someone's birthday or other personal events requiring their attention
          - Any event that would prevent participation in project activities
        - Always analyze the context of the request to determine the appropriate status
        
        ## OFF-TOPIC RESPONSE
        The user has sent a message that is not related to scheduling or planning.
        Generate a short, funny response (50-100 characters) that:
        1. Acknowledges their message in a humorous way
        2. Gently reminds them that you're a scheduling bot
        3. Uses a scheduling/calendar pun or joke if possible
        4. Keeps a light, friendly tone
        
        Your response should be brief, witty, and not condescending.
        `,
      };

      // Make API call
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [systemMessage, ...conversationHistory],
        tools: timeslotTools,
        temperature: 0.7,
      });

      // Check if there are tool calls in the response
      let toolCallSuccess = false;
      let assistantMessage = '';

      if (
        response.choices[0].message.tool_calls &&
        response.choices[0].message.tool_calls.length > 0
      ) {
        // Process tool calls
        this.logger.log(
          `Tool calls detected: ${response.choices[0].message.tool_calls.length}`,
        );

        // Create an array to store each function call result
        const toolCallResults: {
          tool_call_id: string;
          function_name: string;
          success: boolean;
          result?: TimeslotToolResult;
          error?: string;
        }[] = [];
        let anyToolCallFailed = false;

        for (const toolCall of response.choices[0].message.tool_calls) {
          try {
            const result = await this.callFunction(toolCall);
            toolCallResults.push({
              tool_call_id: toolCall.id,
              function_name: toolCall.function.name,
              success: result.success,
              result,
            });
            if (!result.success) anyToolCallFailed = true;
          } catch (error) {
            this.logger.error(`Error calling function: ${error}`);
            toolCallResults.push({
              tool_call_id: toolCall.id,
              function_name: toolCall.function.name,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
            anyToolCallFailed = true;
          }
        }

        // Set tool call success flag
        toolCallSuccess = !anyToolCallFailed;

        // Add assistant's tool call message to the history
        conversationHistory.push(response.choices[0].message);

        // Create messages for the tool call results
        const toolResponseMessages = toolCallResults.map((result) => ({
          role: 'tool' as const,
          tool_call_id: result.tool_call_id,
          content: JSON.stringify(result),
        }));

        // Add tool response messages to conversation history
        conversationHistory.push(...toolResponseMessages);

        // Now get a follow-up response from the assistant
        const followupResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [...conversationHistory],
          temperature: 0.7,
        });

        // Get the follow-up response
        assistantMessage = followupResponse.choices[0].message.content || '';

        // Add the follow-up response to conversation history
        conversationHistory.push({
          role: 'assistant',
          content: assistantMessage,
        });
      } else {
        // No tool calls, just use the original response
        assistantMessage = response.choices[0].message.content || '';

        // Add assistant response to conversation history
        conversationHistory.push({
          role: 'assistant',
          content: assistantMessage,
        });
      }

      // Update conversation context
      this.updateConversationContext(contextId, conversationHistory);

      return {
        text: assistantMessage,
        timeslots: timeSlots,
        toolCallSuccess,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Error processing message with OpenAI: ${errorMessage}`,
      );
      return {
        text: 'Sorry, I encountered an error while processing your message. Please try again later.',
        toolCallSuccess: false,
      };
    }
  }

  /**
   * Transcribe voice message
   */
  async transcribeAudio(fileBuffer: Buffer, filename: string): Promise<string> {
    try {
      // Create temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, filename);
      fs.writeFileSync(tempFilePath, fileBuffer);

      // Create file object for OpenAI API
      const file = fs.createReadStream(tempFilePath);

      // Call Whisper API
      const transcription = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      return transcription.text;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error transcribing audio: ${errorMessage}`);
      return '';
    }
  }

  /**
   * Get conversation context
   */
  private getConversationContext(
    contextId: string,
  ): ChatCompletionMessageParam[] {
    if (!this.conversationContexts.has(contextId)) {
      this.conversationContexts.set(contextId, []);
    }
    return [...this.conversationContexts.get(contextId)];
  }

  /**
   * Update conversation context, limiting history to last 10 messages
   */
  private updateConversationContext(
    contextId: string,
    messages: ChatCompletionMessageParam[],
  ): void {
    // Keep only the last 10 messages to prevent context from growing too large
    const limitedMessages = messages.slice(-10);

    // Make sure we don't break the tool calls pattern in the messages
    const finalMessages = [...limitedMessages];

    // Check for valid tool calls pattern
    this.validateToolCallsPattern(finalMessages);

    this.conversationContexts.set(contextId, finalMessages);
  }

  /**
   * Validate and fix the tool calls pattern in the conversation messages
   * This ensures that:
   * 1. Every 'tool' message has a preceding assistant message with matching tool_call_id
   * 2. Every tool_call in assistant messages has a corresponding 'tool' response message
   */
  private validateToolCallsPattern(
    messages: ChatCompletionMessageParam[],
  ): void {
    // Check for tool messages without matching tool_calls
    const toolMessages = messages.filter((msg) => msg.role === 'tool');

    if (toolMessages.length > 0) {
      // First get all tool_call_ids from tool messages
      const toolCallIdsFromToolMessages = new Set(
        toolMessages
          .map((msg) => ('tool_call_id' in msg ? msg.tool_call_id : null))
          .filter((id) => id !== null),
      );

      // Now find all assistant messages with tool_calls
      const assistantMessagesWithToolCalls = messages.filter(
        (msg) =>
          msg.role === 'assistant' &&
          msg.tool_calls &&
          msg.tool_calls.length > 0,
      );

      // Track which tool_call_ids we need to remove
      const toolCallIdsToRemove = new Set<string>();

      // Get all tool_call_ids from the assistant messages
      const allToolCallIds = new Set<string>();

      for (const msg of assistantMessagesWithToolCalls) {
        if ('tool_calls' in msg && Array.isArray(msg.tool_calls)) {
          for (const toolCall of msg.tool_calls) {
            allToolCallIds.add(toolCall.id);
          }
        }
      }

      // Check if each tool message has a corresponding tool_call
      for (const toolCallId of toolCallIdsFromToolMessages) {
        if (!allToolCallIds.has(toolCallId)) {
          toolCallIdsToRemove.add(toolCallId);
        }
      }

      // Check if each tool_call has a corresponding tool message
      for (const toolCallId of allToolCallIds) {
        const hasCorrespondingToolMessage = toolMessages.some(
          (msg) => 'tool_call_id' in msg && msg.tool_call_id === toolCallId,
        );

        if (!hasCorrespondingToolMessage) {
          toolCallIdsToRemove.add(toolCallId);
        }
      }

      // If we need to remove any tool messages or tool_calls, do it
      if (toolCallIdsToRemove.size > 0) {
        this.logger.log(
          `Fixing conversation history - removing ${toolCallIdsToRemove.size} problematic tool interactions`,
        );

        // Remove problematic tool messages
        const filteredMessages = messages.filter(
          (msg) =>
            msg.role !== 'tool' ||
            !('tool_call_id' in msg) ||
            !toolCallIdsToRemove.has(msg.tool_call_id),
        );

        // Remove problematic tool_calls from assistant messages
        messages.length = 0; // Clear the array without creating a new one

        for (const msg of filteredMessages) {
          if (
            msg.role === 'assistant' &&
            msg.tool_calls &&
            msg.tool_calls.length > 0
          ) {
            // Create a modified version of the message with filtered tool_calls
            const filteredToolCalls = msg.tool_calls.filter(
              (tc) => !toolCallIdsToRemove.has(tc.id),
            );

            if (filteredToolCalls.length > 0) {
              // If there are still valid tool_calls, keep them
              messages.push({
                ...msg,
                tool_calls: filteredToolCalls,
              });
            } else {
              // If no valid tool_calls remain, drop them completely
              // Create a new object without the tool_calls property
              const msgWithoutToolCalls = { ...msg };
              delete msgWithoutToolCalls.tool_calls;
              messages.push(msgWithoutToolCalls);
            }
          } else {
            // Keep other messages as they are
            messages.push(msg);
          }
        }
      }
    }
  }
}
