/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { TimeslotToolService } from './timeslot-tool.service';

@WebSocketGateway({
  transports: ['websocket', 'polling'],
  namespace: '/socket',
})
export class TimeslotGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TimeslotGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly timeslotToolService: TimeslotToolService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('project_add_timeslots')
  async handleAddTimeslots(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      projectId: number;
      userId: number;
      timeslots: Array<{
        startTime: string;
        endTime: string;
        notes?: string;
        status: 'available' | 'busy';
        isLocked?: boolean;
        label?: string;
        color?: string;
      }>;
      createdById?: number;
    },
  ) {
    this.logger.log(`Adding timeslots for project ${data.projectId}`);
    try {
      const result = await this.timeslotToolService.addTimeslots(data);

      if (result.success) {
        // Broadcast to all connected clients that timeslots were added
        this.server.emit('timeslots_updated', {
          projectId: data.projectId,
          userId: data.userId,
        });
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error adding timeslots: ${errorMessage}`);
      return {
        success: false,
        error: `Error adding timeslots: ${errorMessage}`,
      };
    }
  }

  @SubscribeMessage('project_update_timeslots')
  async handleUpdateTimeslots(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      projectId: number;
      timeslots: Array<{
        id: number;
        startTime?: string;
        endTime?: string;
        notes?: string;
        status?: 'available' | 'busy';
        isLocked?: boolean;
        label?: string;
        color?: string;
      }>;
      requestUserTelegramId?: number;
      requestUserId?: number;
    },
  ) {
    this.logger.log(`Updating timeslots for project ${data.projectId}`);
    try {
      let requestUserId = data.requestUserId;

      // If requestUserId is not provided but requestUserTelegramId is, convert it
      if (!requestUserId && data.requestUserTelegramId) {
        const user = await this.timeslotToolService.findUserByTelegramId(
          data.requestUserTelegramId,
        );
        if (!user) {
          return {
            success: false,
            error: `User with Telegram ID ${data.requestUserTelegramId} not found`,
          };
        }
        requestUserId = user.id;
      }

      if (!requestUserId) {
        return {
          success: false,
          error:
            'Either requestUserId or requestUserTelegramId must be provided',
        };
      }

      const result = await this.timeslotToolService.updateTimeslots({
        projectId: data.projectId,
        timeslots: data.timeslots,
        requestUserId: requestUserId,
      });

      if (result.success) {
        // Broadcast to all connected clients that timeslots were updated
        this.server.emit('timeslots_updated', {
          projectId: data.projectId,
        });
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error updating timeslots: ${errorMessage}`);
      return {
        success: false,
        error: `Error updating timeslots: ${errorMessage}`,
      };
    }
  }

  @SubscribeMessage('project_delete_timeslots')
  async handleDeleteTimeslots(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      projectId: number;
      timeslotIds: number[];
      requestUserTelegramId?: number;
      requestUserId?: number;
    },
  ) {
    this.logger.log(`Deleting timeslots for project ${data.projectId}`);
    try {
      let requestUserId = data.requestUserId;

      // If requestUserId is not provided but requestUserTelegramId is, convert it
      if (!requestUserId && data.requestUserTelegramId) {
        const user = await this.timeslotToolService.findUserByTelegramId(
          data.requestUserTelegramId,
        );
        if (!user) {
          return {
            success: false,
            error: `User with Telegram ID ${data.requestUserTelegramId} not found`,
          };
        }
        requestUserId = user.id;
      }

      if (!requestUserId) {
        return {
          success: false,
          error:
            'Either requestUserId or requestUserTelegramId must be provided',
        };
      }

      const result = await this.timeslotToolService.deleteTimeslots({
        projectId: data.projectId,
        timeslotIds: data.timeslotIds,
        requestUserId: requestUserId,
      });

      if (result.success) {
        // Broadcast to all connected clients that timeslots were deleted
        this.server.emit('timeslots_updated', {
          projectId: data.projectId,
        });
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error deleting timeslots: ${errorMessage}`);
      return {
        success: false,
        error: `Error deleting timeslots: ${errorMessage}`,
      };
    }
  }

  @SubscribeMessage('project_merge_timeslots')
  async handleMergeTimeslots(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      projectId: number;
      timeslotIds: number[];
      requestUserTelegramId?: number;
      requestUserId?: number;
      mergedNotes?: string;
    },
  ) {
    this.logger.log(`Merging timeslots for project ${data.projectId}`);
    try {
      let requestUserId = data.requestUserId;

      // If requestUserId is not provided but requestUserTelegramId is, convert it
      if (!requestUserId && data.requestUserTelegramId) {
        const user = await this.timeslotToolService.findUserByTelegramId(
          data.requestUserTelegramId,
        );
        if (!user) {
          return {
            success: false,
            error: `User with Telegram ID ${data.requestUserTelegramId} not found`,
          };
        }
        requestUserId = user.id;
      }

      if (!requestUserId) {
        return {
          success: false,
          error:
            'Either requestUserId or requestUserTelegramId must be provided',
        };
      }

      const result = await this.timeslotToolService.mergeTimeslots({
        projectId: data.projectId,
        timeslotIds: data.timeslotIds,
        requestUserId: requestUserId,
        mergedNotes: data.mergedNotes,
      });

      if (result.success) {
        // Broadcast to all connected clients that timeslots were merged
        this.server.emit('timeslots_updated', {
          projectId: data.projectId,
        });
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error merging timeslots: ${errorMessage}`);
      return {
        success: false,
        error: `Error merging timeslots: ${errorMessage}`,
      };
    }
  }

  // Additional helper method to get timeslots for a user
  @SubscribeMessage('get_user_timeslots')
  async handleGetUserTimeslots(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      projectId: number;
      userId: number;
    },
  ) {
    this.logger.log(
      `Getting timeslots for user ${data.userId} in project ${data.projectId}`,
    );
    try {
      const timeslots = await this.timeslotToolService.getUserTimeSlots(
        data.userId,
        data.projectId,
      );

      return {
        success: true,
        timeslots,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting timeslots: ${errorMessage}`);
      return {
        success: false,
        error: `Error getting timeslots: ${errorMessage}`,
      };
    }
  }

  // Get timeslots for a user by Telegram ID
  @SubscribeMessage('get_user_timeslots_by_telegram')
  async handleGetUserTimeslotsByTelegram(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      projectId: number;
      telegramId: number;
    },
  ) {
    this.logger.log(
      `Getting timeslots for telegram user ${data.telegramId} in project ${data.projectId}`,
    );
    try {
      const result =
        await this.timeslotToolService.getUserTimeSlotsByTelegramId(
          data.telegramId,
          data.projectId,
        );

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error getting timeslots by Telegram ID: ${errorMessage}`,
      );
      return {
        success: false,
        error: `Error getting timeslots: ${errorMessage}`,
      };
    }
  }
}
