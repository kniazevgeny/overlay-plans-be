import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from 'openai/resources';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;
  private readonly logger = new Logger(OpenAIService.name);
  private conversationContexts: Map<string, ChatCompletionMessageParam[]> =
    new Map();

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.error(
        'OPENAI_API_KEY is not defined in environment variables',
      );
    }
    this.openai = new OpenAI({
      apiKey,
    });
  }

  /**
   * Analyze a message to determine if it's a request to change a time slot's status
   * This helps identify if the user wants to switch slots between available and busy
   */
  async analyzeSlotTypeChangeRequest(
    message: string,
    userTimeSlots: {
      id: number;
      startTime: Date;
      endTime: Date;
      status: 'available' | 'busy';
      notes?: string;
    }[],
  ): Promise<{
    isChangeRequest: boolean;
    slotsToChange: number[]; // Array of time slot IDs to change
    targetStatus?: 'available' | 'busy'; // Optional specific status to set
    confidence: number; // How confident we are that this is a change request
    reasoning: string; // Why we think this is or isn't a change request
  }> {
    try {
      if (!userTimeSlots || userTimeSlots.length === 0) {
        return {
          isChangeRequest: false,
          slotsToChange: [],
          confidence: 0,
          reasoning: 'No time slots available to analyze',
        };
      }

      // Define the slot management tools
      const slotTools: ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: 'getTimeSlots',
            description: 'Get current time slots for a user',
            parameters: undefined,
          },
        },
        {
          type: 'function',
          function: {
            name: 'analyzeChangeRequest',
            description:
              'Analyze if a message is a request to change time slot status',
            parameters: {
              type: 'object',
              properties: {
                isChangeRequest: {
                  type: 'boolean',
                  description:
                    'Whether the message is a request to change time slot status',
                },
                slotsToChange: {
                  type: 'array',
                  items: { type: 'integer' },
                  description: 'Array of slot IDs that should be changed',
                },
                targetStatus: {
                  type: 'string',
                  enum: ['available', 'busy', null],
                  description:
                    'The target status to set, or null to toggle the current status',
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: 'Confidence level, from 0 to 1',
                },
                reasoning: {
                  type: 'string',
                  description:
                    "Explanation for why this is or isn't a change request",
                },
              },
              required: [
                'isChangeRequest',
                'slotsToChange',
                'confidence',
                'reasoning',
              ],
            },
          },
        },
      ];

      // System message with enhanced instructions for multilingual support and various reference formats
      const systemMessage: ChatCompletionMessageParam = {
        role: 'system',
        content: `You are an AI assistant helping users manage their schedule and time slots in multiple languages including English, Russian, and others.
        
        The user may want to change the status of their time slots between "available" and "busy".
        
        You can access the user's time slots by calling the getTimeSlots function.
        
        Analyze the message to determine if the user wants to change the status of specific time slots. Look for the following patterns:
        
        1. Slot references by ID: "change slot 3 to busy"
        2. Time references: "19-23 это отметь как занятый слот" (mark 19-23 as busy slot)
        3. Descriptions that match time slots: "mark my evening slot as busy"
        4. Implicit references: "the first slot should be available"
        
        Users may refer to time slots in different ways:
        - By ID number: "2", "slot #3"
        - By time range: "19-23", "from 2pm to 5pm"
        - By relative position: "first one", "last slot", "evening slot"
        - By description that matches notes: "the meeting slot", "lunch break"
        
        For multilingual support, understand key terms in different languages:
        - English: "available", "busy", "free", "occupied", "mark", "change"
        - Russian: "свободный", "занятый", "доступный", "отметь", "измени"
        
        Confidence levels should be:
        - 0.9-1.0: Explicit request to change slots with clear slot identification
        - 0.7-0.9: Clear intent to change, but slot references might be ambiguous
        - 0.4-0.7: Possible intent to change, but requires interpretation
        - Below 0.4: Likely not a change request
        
        If the user doesn't specify a particular status (available/busy), leave "targetStatus" as null, which will toggle the current status.
        
        Try to identify which specific slots the user is referring to by matching their description to the available slots.`,
      };

      const userMessage: ChatCompletionMessageParam = {
        role: 'user',
        content: message,
      };

      // Function to handle tool calls
      const handleToolCalls = (
        toolCalls: Array<{
          id: string;
          type: 'function';
          function: {
            name: string;
            arguments: string;
          };
        }>,
      ): ChatCompletionToolMessageParam => {
        const results = [];

        for (const toolCall of toolCalls) {
          if (toolCall.function.name === 'getTimeSlots') {
            // Return formatted time slots with more detailed information
            const formattedSlots = userTimeSlots.map((slot) => {
              const startTime = new Date(slot.startTime).toLocaleString();
              const endTime = new Date(slot.endTime).toLocaleString();
              // Also include formatted time ranges like "19-23" to help with matching
              const startHour = new Date(slot.startTime).getHours();
              const endHour = new Date(slot.endTime).getHours();
              const timeRange = `${startHour}-${endHour}`;

              return `Time Slot ID: ${slot.id}, Time: ${startTime} - ${endTime}, Range: ${timeRange}, Status: ${slot.status}${
                slot.notes ? `, Notes: ${slot.notes}` : ''
              }`;
            });

            results.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify({
                slots: userTimeSlots,
                formattedSlots: formattedSlots,
              }),
            });
          }
          // We don't need to handle analyzeChangeRequest as it's the final output
        }

        return {
          role: 'tool',
          tool_call_id: toolCalls[0].id, // Required field for ChatCompletionToolMessageParam
          content: JSON.stringify({
            slots: userTimeSlots,
            formattedSlots: userTimeSlots.map((slot) => {
              const startTime = new Date(slot.startTime);
              const endTime = new Date(slot.endTime);
              const startHour = startTime.getHours();
              const endHour = endTime.getHours();
              const timeRange = `${startHour}-${endHour}`;

              return `${slot.id}: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}, Range: ${timeRange}, Status: ${slot.status}`;
            }),
          }),
        };
      };

      // Make initial API call
      let response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [systemMessage, userMessage],
        tools: slotTools,
        temperature: 0.2, // Lower temperature for more deterministic analysis
      });

      // Process tool calls if any
      let assistantMessage = response.choices[0].message;
      const messages = [systemMessage, userMessage, assistantMessage];

      // Handle any tool calls recursively until we get a final analysis
      while (
        assistantMessage.tool_calls &&
        !assistantMessage.tool_calls.some(
          (tc) => tc?.function?.name === 'analyzeChangeRequest',
        )
      ) {
        const toolResponse = handleToolCalls(assistantMessage.tool_calls);
        messages.push(
          toolResponse as unknown as ChatCompletionSystemMessageParam,
        );

        // Make another API call with the tool response
        response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          tools: slotTools,
          temperature: 0.2,
        });

        assistantMessage = response.choices[0].message;
        messages.push(assistantMessage);
      }

      // Extract the analysis from the function call
      if (assistantMessage.tool_calls) {
        const analyzeCall = assistantMessage.tool_calls.find(
          (tc) => tc?.function?.name === 'analyzeChangeRequest',
        );

        if (
          analyzeCall &&
          analyzeCall.function &&
          analyzeCall.function.arguments
        ) {
          try {
            const analysis = JSON.parse(analyzeCall.function.arguments) as {
              isChangeRequest: boolean;
              slotsToChange: number[];
              targetStatus?: 'available' | 'busy';
              confidence: number;
              reasoning: string;
            };

            return {
              isChangeRequest: analysis.isChangeRequest || false,
              slotsToChange: analysis.slotsToChange || [],
              targetStatus: analysis.targetStatus,
              confidence: analysis.confidence || 0,
              reasoning: analysis.reasoning || 'No reasoning provided',
            };
          } catch (parseError) {
            this.logger.error(
              'Error parsing analysis function call',
              parseError,
            );
          }
        }
      }

      // Fallback to old method if function calling didn't work
      const finalContent = assistantMessage.content || '{}';
      try {
        // Try to parse as JSON if there was no function call
        const parsedResponse = JSON.parse(finalContent) as {
          isChangeRequest: boolean;
          slotsToChange: number[];
          targetStatus?: 'available' | 'busy';
          confidence: number;
          reasoning: string;
        };

        return {
          isChangeRequest: parsedResponse.isChangeRequest || false,
          slotsToChange: parsedResponse.slotsToChange || [],
          targetStatus: parsedResponse.targetStatus,
          confidence: parsedResponse.confidence || 0,
          reasoning: parsedResponse.reasoning || 'No reasoning provided',
        };
      } catch (parseError) {
        this.logger.error(
          'Error parsing slot change analysis response',
          parseError,
        );
        return {
          isChangeRequest: false,
          slotsToChange: [],
          confidence: 0,
          reasoning: 'Error parsing analysis response',
        };
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Error analyzing slot type change request: ${errorMessage}`,
      );
      return {
        isChangeRequest: false,
        slotsToChange: [],
        confidence: 0,
        reasoning: `Error processing request: ${errorMessage}`,
      };
    }
  }

  /**
   * Extract user references from a message
   * This helps identify users mentioned in natural language
   */
  async extractUserReferences(
    message: string,
    projectUsers: {
      id: number;
      firstName?: string;
      lastName?: string;
      username?: string;
    }[],
  ): Promise<{ userId: number; confidence: number }[]> {
    try {
      // Prepare user information for context
      const userList = projectUsers
        .map(
          (user) =>
            `User ID: ${user.id}, Name: ${user.firstName || ''} ${user.lastName || ''}, Username: ${user.username || ''}`,
        )
        .join('\n');

      // System message with instructions for user extraction
      const systemMessage: ChatCompletionMessageParam = {
        role: 'system',
        content: `You are a natural language processing assistant specialized in identifying references to users in messages.
        You'll be given a message that might refer to users, and a list of available users in the project.
        
        The available users are:
        ${userList}
        
        Your task is to identify which user(s) the message is referring to. Look for:
        1. Direct references by username (e.g., "John", "@john")
        2. Indirect references that seem to describe a user (e.g., "the project manager")
        3. Contextual clues about who the message might be talking about
        
        Return your analysis as a JSON array with user IDs and confidence scores:
        [
          {
            "userId": 123,
            "confidence": 0.95,
            "reasoning": "Directly mentioned by first name 'John'"
          }
        ]
        
        Confidence should be between 0 and 1, where:
        - 0.9-1.0: Explicitly mentioned by name/username
        - 0.7-0.9: Strong contextual evidence
        - 0.4-0.7: Moderate evidence
        - Below 0.4: Weak or speculative connection
        
        If no users are referenced, return an empty array: []`,
      };

      const userMessage: ChatCompletionMessageParam = {
        role: 'user',
        content: message,
      };

      // Make API call to extract user references
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [systemMessage, userMessage],
        temperature: 0.3, // Lower temperature for more deterministic responses
        response_format: { type: 'json_object' },
      });

      // Get assistant response
      const assistantMessage = response.choices[0].message.content || '{}';

      try {
        const parsedResponse = JSON.parse(assistantMessage) as {
          users?: { userId: number; confidence: number }[];
          userReferences?: { userId: number; confidence: number }[];
        };

        if (Array.isArray(parsedResponse)) {
          return parsedResponse;
        } else if (parsedResponse && Array.isArray(parsedResponse.users)) {
          return parsedResponse.users;
        } else if (
          parsedResponse &&
          Array.isArray(parsedResponse.userReferences)
        ) {
          return parsedResponse.userReferences;
        } else {
          this.logger.warn(
            'Unexpected response format from OpenAI user extraction',
            parsedResponse,
          );
          return [];
        }
      } catch (parseError) {
        this.logger.error('Error parsing user extraction response', parseError);
        return [];
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`Error extracting user references: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Process text message with ChatGPT
   */
  async processMessage(
    message: string,
    projectId: number,
    contextId: string = `project-${projectId}`,
  ): Promise<{ text: string; timeslots?: any[]; isProjectRelated: boolean }> {
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

      // System message with instructions for timeslot extraction
      const systemMessage: ChatCompletionMessageParam = {
        role: 'system',
        content: `You are an AI assistant helping users manage their schedule. 
        Today's date and time is ${localDateString} (${dateTimeString}).
        If the user mentions any time slots or scheduling information, extract that information.
        
        Return your response in a conversational way, but also add two JSON objects at the end of your message:
        
        1. If you detect time slots, add a JSON object with the extracted time information:
        [TIMESLOTS_JSON]
        {
          "timeslots": [
            {
              "startTime": "2023-04-10T14:00:00", // ISO format date-time
              "endTime": "2023-04-10T16:00:00",   // ISO format date-time
              "notes": "Meeting with team",        // Description of the event
              "status": "available"                // Either "available" or "busy"
            }
          ]
        }
        [/TIMESLOTS_JSON]
        
        Distinguish between "available" and "busy" slots:
        - If the user is telling you when they are free/available, mark those as "available"
        - If the user is telling you when they are busy/occupied/have meetings, mark those as "busy"
        - By default, assume slots are "available" unless clearly indicated otherwise
        
        2. Always add a JSON classification of whether the message is related to scheduling, planning, or calendar management:
        [CLASSIFICATION_JSON]
        {
          "isProjectRelated": true/false  // true if the message is about scheduling, planning, or calendar management
        }
        [/CLASSIFICATION_JSON]`,
      };

      // Make API call
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [systemMessage, ...conversationHistory],
        temperature: 0.7,
      });

      // Get assistant response
      const assistantMessage = response.choices[0].message.content || '';

      // Add assistant response to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      // Update conversation context
      this.updateConversationContext(contextId, conversationHistory);

      // Extract time slots if present
      const timeslots = this.extractTimeslots(assistantMessage);

      // Extract classification
      const classification = this.extractClassification(assistantMessage);
      const isProjectRelated = classification?.isProjectRelated ?? true; // Default to true if extraction fails

      // Return clean message (without the JSON parts)
      const cleanMessage = this.removeJsonParts(assistantMessage);

      return {
        text: cleanMessage,
        timeslots: timeslots,
        isProjectRelated: isProjectRelated,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Error processing message with OpenAI: ${errorMessage}`,
      );
      return {
        text: 'Sorry, I encountered an error while processing your message. Please try again later.',
        isProjectRelated: true, // Default to true in case of error
      };
    }
  }

  /**
   * Generate a funny response for off-topic messages
   */
  async generateFunnyResponse(message: string): Promise<string> {
    try {
      const funnyPrompt: ChatCompletionMessageParam = {
        role: 'system',
        content: `You are an AI assistant that specifically helps with scheduling and planning. 
        The user has sent a message that is not related to scheduling or planning.
        Generate a short, funny response (50-100 characters) that:
        1. Acknowledges their message in a humorous way
        2. Gently reminds them that you're a scheduling bot
        3. Uses a scheduling/calendar pun or joke if possible
        4. Keeps a light, friendly tone
        
        Your response should be brief, witty, and not condescending.`,
      };

      const userMessage: ChatCompletionMessageParam = {
        role: 'user',
        content: message,
      };

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [funnyPrompt, userMessage],
        temperature: 0.9, // Higher temperature for more creative responses
        max_tokens: 100, // Keep responses short
      });

      return (
        response.choices[0].message.content ||
        "I'd love to chat, but my calendar keeps beeping at me. Let's talk scheduling!"
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error generating funny response: ${errorMessage}`);
      return "That's interesting! But speaking of interesting things, have you tried scheduling your day with me?";
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
   * Extract timeslots from assistant message
   */
  private extractTimeslots(message: string): any[] {
    try {
      const timeslotsMatch = message.match(
        /\[TIMESLOTS_JSON\]([\s\S]*?)\[\/TIMESLOTS_JSON\]/,
      );
      if (timeslotsMatch && timeslotsMatch[1]) {
        const jsonStr = timeslotsMatch[1].trim();
        const data = JSON.parse(jsonStr) as { timeslots: any[] };
        return data.timeslots || [];
      }
      return [];
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error extracting timeslots: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Extract classification from assistant message
   */
  private extractClassification(
    message: string,
  ): { isProjectRelated: boolean } | null {
    try {
      const classificationMatch = message.match(
        /\[CLASSIFICATION_JSON\]([\s\S]*?)\[\/CLASSIFICATION_JSON\]/,
      );
      if (classificationMatch && classificationMatch[1]) {
        const jsonStr = classificationMatch[1].trim();
        return JSON.parse(jsonStr) as { isProjectRelated: boolean };
      }
      return null;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error extracting classification: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Remove JSON parts from message
   */
  private removeJsonParts(message: string): string {
    return message
      .replace(/\[TIMESLOTS_JSON\][\s\S]*?\[\/TIMESLOTS_JSON\]/, '')
      .replace(/\[CLASSIFICATION_JSON\][\s\S]*?\[\/CLASSIFICATION_JSON\]/, '')
      .trim();
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
    this.conversationContexts.set(contextId, limitedMessages);
  }
}
