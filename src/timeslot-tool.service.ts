import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlot } from './entities/time-slot.entity';
import { Project } from './entities/project.entity';
import { User } from './entities/user.entity';
import { In } from 'typeorm';

@Injectable()
export class TimeslotToolService {
  private readonly logger = new Logger(TimeslotToolService.name);

  constructor(
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get time slots for a specific user in a project
   */
  async getUserTimeSlots(
    userId: number,
    projectId: number,
  ): Promise<TimeSlot[]> {
    try {
      const timeSlots = await this.timeSlotRepository.find({
        where: {
          user: { id: userId },
          project: { id: projectId },
        },
        order: { startTime: 'ASC' },
      });

      return timeSlots;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting user time slots: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Add timeslots to a project
   */
  async addTimeslots(params: {
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
  }): Promise<{
    success: boolean;
    timeslots?: TimeSlot[];
    error?: string;
  }> {
    try {
      // Find project
      const project = await this.projectRepository.findOne({
        where: { id: params.projectId },
      });

      if (!project) {
        return {
          success: false,
          error: `Project with ID ${params.projectId} not found`,
        };
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: params.userId },
      });

      if (!user) {
        return {
          success: false,
          error: `User with ID ${params.userId} not found`,
        };
      }

      // Find creator (if specified and different from user)
      let creator = user;
      if (params.createdById && params.createdById !== params.userId) {
        creator = await this.userRepository.findOne({
          where: { id: params.createdById },
        });

        if (!creator) {
          return {
            success: false,
            error: `Creator with ID ${params.createdById} not found`,
          };
        }
      }

      // Create and save timeslots
      const createdTimeslots = await Promise.all(
        params.timeslots.map(async (slot) => {
          const timeSlot = this.timeSlotRepository.create({
            startTime: new Date(slot.startTime),
            endTime: new Date(slot.endTime),
            notes: slot.notes || '',
            status: slot.status,
            isLocked: slot.isLocked || false,
            label: slot.label || '',
            color: slot.color,
            project: project,
            user: user,
            participantFor: user,
            createdBy: creator,
            createdAt: new Date(),
          });

          return this.timeSlotRepository.save(timeSlot);
        }),
      );

      return {
        success: true,
        timeslots: createdTimeslots,
      };
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

  /**
   * Update timeslots with verification that they belong to the project
   */
  async updateTimeslots(params: {
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
    requestUserId: number;
  }): Promise<{
    success: boolean;
    timeslots?: TimeSlot[];
    error?: string;
  }> {
    try {
      // Extract all timeslot IDs for verification
      const timeslotIds = params.timeslots.map((slot) => slot.id);

      // Verify all timeslots belong to the specified project
      const existingTimeslots = await this.timeSlotRepository.find({
        where: { id: In(timeslotIds) },
        relations: ['project', 'user', 'createdBy'],
      });

      // Check if we found all timeslots
      if (existingTimeslots.length !== timeslotIds.length) {
        const foundIds = existingTimeslots.map((slot) => slot.id);
        const missingIds = timeslotIds.filter((id) => !foundIds.includes(id));
        return {
          success: false,
          error: `Some timeslots were not found: ${missingIds.join(', ')}`,
        };
      }

      // Check if all timeslots belong to the specified project
      const invalidTimeslots = existingTimeslots.filter(
        (slot) => slot.project.id !== params.projectId,
      );

      if (invalidTimeslots.length > 0) {
        const invalidIds = invalidTimeslots.map((slot) => slot.id);
        return {
          success: false,
          error: `Timeslots [${invalidIds.join(', ')}] do not belong to project ${params.projectId}`,
        };
      }

      // Get the requesting user
      const requestUser = await this.userRepository.findOne({
        where: { id: params.requestUserId },
      });

      if (!requestUser) {
        return {
          success: false,
          error: `Requesting user with ID ${params.requestUserId} not found`,
        };
      }

      // Update each timeslot
      const updatedTimeslots = await Promise.all(
        params.timeslots.map(async (update) => {
          const timeSlot = existingTimeslots.find(
            (slot) => slot.id === update.id,
          );

          // Check if user has permission to modify this timeslot
          // Users can only modify locked timeslots if they created them
          if (
            timeSlot.isLocked &&
            timeSlot.createdBy?.id !== params.requestUserId &&
            timeSlot.user.id !== params.requestUserId
          ) {
            throw new Error(
              `User ${params.requestUserId} cannot modify locked timeslot ${update.id}`,
            );
          }

          // Apply updates
          if (update.startTime) {
            timeSlot.startTime = new Date(update.startTime);
          }

          if (update.endTime) {
            timeSlot.endTime = new Date(update.endTime);
          }

          if (update.notes !== undefined) {
            timeSlot.notes = update.notes;
          }

          if (update.status) {
            timeSlot.status = update.status;
          }

          if (update.isLocked !== undefined) {
            timeSlot.isLocked = update.isLocked;
          }

          if (update.label !== undefined) {
            timeSlot.label = update.label;
          }

          if (update.color !== undefined) {
            timeSlot.color = update.color;
          }

          timeSlot.updatedAt = new Date();

          return this.timeSlotRepository.save(timeSlot);
        }),
      );

      return {
        success: true,
        timeslots: updatedTimeslots,
      };
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

  /**
   * Delete timeslots with verification that they belong to the project
   */
  async deleteTimeslots(params: {
    projectId: number;
    timeslotIds: number[];
    requestUserId: number;
  }): Promise<{
    success: boolean;
    deletedCount?: number;
    error?: string;
  }> {
    try {
      // Verify all timeslots belong to the specified project
      const existingTimeslots = await this.timeSlotRepository.find({
        where: { id: In(params.timeslotIds) },
        relations: ['project', 'user', 'createdBy'],
      });

      // Check if we found all timeslots
      if (existingTimeslots.length !== params.timeslotIds.length) {
        const foundIds = existingTimeslots.map((slot) => slot.id);
        const missingIds = params.timeslotIds.filter(
          (id) => !foundIds.includes(id),
        );
        return {
          success: false,
          error: `Some timeslots were not found: ${missingIds.join(', ')}`,
        };
      }

      // Check if all timeslots belong to the specified project
      const invalidTimeslots = existingTimeslots.filter(
        (slot) => slot.project.id !== params.projectId,
      );

      if (invalidTimeslots.length > 0) {
        const invalidIds = invalidTimeslots.map((slot) => slot.id);
        return {
          success: false,
          error: `Timeslots [${invalidIds.join(', ')}] do not belong to project ${params.projectId}`,
        };
      }

      // Get the requesting user
      const requestUser = await this.userRepository.findOne({
        where: { id: params.requestUserId },
      });

      if (!requestUser) {
        return {
          success: false,
          error: `Requesting user with ID ${params.requestUserId} not found`,
        };
      }

      // Check permissions for each timeslot
      for (const timeSlot of existingTimeslots) {
        // Users can only delete locked timeslots if they created them or if they are the assigned user
        if (
          timeSlot.isLocked &&
          timeSlot.createdBy?.id !== params.requestUserId &&
          timeSlot.user.id !== params.requestUserId
        ) {
          return {
            success: false,
            error: `User ${params.requestUserId} cannot delete locked timeslot ${timeSlot.id}`,
          };
        }
      }

      // Delete all timeslots
      const deleteResult = await this.timeSlotRepository.delete({
        id: In(params.timeslotIds),
      });

      return {
        success: true,
        deletedCount: deleteResult.affected,
      };
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

  /**
   * Merge overlapping or adjacent timeslots into a single timeslot
   */
  async mergeTimeslots(params: {
    projectId: number;
    timeslotIds: number[];
    requestUserId: number;
    mergedNotes?: string;
  }): Promise<{
    success: boolean;
    timeslots?: TimeSlot[];
    error?: string;
  }> {
    try {
      // Verify all timeslots belong to the specified project
      const existingTimeslots = await this.timeSlotRepository.find({
        where: { id: In(params.timeslotIds) },
        relations: ['project', 'user', 'createdBy'],
      });

      // Check if we found all timeslots
      if (existingTimeslots.length !== params.timeslotIds.length) {
        const foundIds = existingTimeslots.map((slot) => slot.id);
        const missingIds = params.timeslotIds.filter(
          (id) => !foundIds.includes(id),
        );
        return {
          success: false,
          error: `Some timeslots were not found: ${missingIds.join(', ')}`,
        };
      }

      // Check if all timeslots belong to the specified project
      const invalidTimeslots = existingTimeslots.filter(
        (slot) => slot.project.id !== params.projectId,
      );

      if (invalidTimeslots.length > 0) {
        const invalidIds = invalidTimeslots.map((slot) => slot.id);
        return {
          success: false,
          error: `Timeslots [${invalidIds.join(', ')}] do not belong to project ${params.projectId}`,
        };
      }

      // Check that all timeslots have the same user and status
      const firstTimeslot = existingTimeslots[0];
      // const incompatibleTimeslots = existingTimeslots.filter(
      //   (slot) =>
      //     slot.user.id !== firstTimeslot.user.id ||
      //     slot.status !== firstTimeslot.status,
      // );

      // if (incompatibleTimeslots.length > 0) {
      //   const incompatibleIds = incompatibleTimeslots.map((slot) => slot.id);
      //   return {
      //     success: false,
      //     error: `Cannot merge timeslots with different users or statuses: ${incompatibleIds.join(', ')}`,
      //   };
      // }

      // Get the requesting user
      const requestUser = await this.userRepository.findOne({
        where: { id: params.requestUserId },
      });

      if (!requestUser) {
        return {
          success: false,
          error: `Requesting user with ID ${params.requestUserId} not found`,
        };
      }

      // Check permissions for each timeslot
      for (const timeSlot of existingTimeslots) {
        // Users can only modify locked timeslots if they created them or if they are the assigned user
        if (
          timeSlot.isLocked &&
          timeSlot.createdBy?.id !== params.requestUserId &&
          timeSlot.user.id !== params.requestUserId
        ) {
          return {
            success: false,
            error: `User ${params.requestUserId} cannot modify locked timeslot ${timeSlot.id}`,
          };
        }
      }

      // Sort timeslots by start time
      existingTimeslots.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

      // Find the earliest start time and latest end time
      const earliestStart = existingTimeslots[0].startTime;
      const latestEnd = existingTimeslots.reduce((latest, slot) => {
        const endTime = new Date(slot.endTime).getTime();
        const currentLatest = new Date(latest).getTime();
        return endTime > currentLatest ? slot.endTime : latest;
      }, existingTimeslots[0].endTime);

      // Create a new merged timeslot
      const mergedSlot = this.timeSlotRepository.create({
        project: firstTimeslot.project,
        user: firstTimeslot.user,
        startTime: earliestStart,
        endTime: latestEnd,
        status: firstTimeslot.status,
        notes:
          params.mergedNotes ||
          existingTimeslots
            .map((slot) => slot.notes)
            .filter(Boolean)
            .join('; '),
        isLocked: existingTimeslots.some((slot) => slot.isLocked),
        createdBy: requestUser,
      });

      // Save the merged timeslot
      const savedMergedSlot = await this.timeSlotRepository.save(mergedSlot);

      // Delete the original timeslots
      await this.timeSlotRepository.remove(existingTimeslots);

      return {
        success: true,
        timeslots: [savedMergedSlot],
      };
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
}
