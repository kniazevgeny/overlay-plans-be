import { Context, Markup } from 'telegraf';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';
import { TimeSlot } from '../../entities/time-slot.entity';
import { UserState, UserStateData } from '../types/user-state.types';
import { Logger } from '@nestjs/common';
import { translate } from '../utils/translations';

/**
 * Handlers for project-related actions
 */
export class ProjectHandlers {
  private readonly logger = new Logger(ProjectHandlers.name);

  constructor(
    private readonly userStateMap: Map<number, UserStateData>,
    private readonly configService: ConfigService,
    private readonly userRepository: Repository<User>,
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Show the list of projects for a user
   */
  async showProjectList(ctx: Context): Promise<void> {
    const tgUser = ctx.from;
    if (!tgUser) return;

    // Get user language preference
    const user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    const language = user?.language || 'en';

    // Update user state
    this.userStateMap.set(tgUser.id, {
      state: UserState.AWAITING_PROJECT_SELECTION,
    });

    // Get user's projects
    const userWithProjects = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
      relations: ['projects'],
    });

    if (
      !userWithProjects ||
      !userWithProjects.projects ||
      userWithProjects.projects.length === 0
    ) {
      // Create a first project for the user
      const defaultProject = this.projectRepository.create({
        name: 'My First Project',
        description: 'This is your first project created automatically.',
      });

      await this.projectRepository.save(defaultProject);

      // Make sure user is initialized
      const updatedUser =
        userWithProjects ||
        (await this.userRepository.findOne({
          where: { telegramId: tgUser.id },
        }));

      // Associate project with user
      if (updatedUser) {
        if (!updatedUser.projects) {
          updatedUser.projects = [];
        }
        updatedUser.projects.push(defaultProject);
        await this.userRepository.save(updatedUser);

        // Immediately select the new project
        await this.handleProjectSelection(ctx, defaultProject.id);
        return;
      }
    }

    // Display list of existing projects
    const projectButtons = userWithProjects.projects.map((project) =>
      Markup.button.callback(project.name, `project:${project.id}`),
    );

    const webAppUrl =
      this.configService.get<string>('WEBAPP_URL') + '/new-project';
    await ctx.reply(
      translate(language, 'selectProject'),
      Markup.inlineKeyboard(
        [...projectButtons, Markup.button.url('Create New Project', webAppUrl)],
        { columns: 1 },
      ),
    );
  }

  /**
   * Handle project selection
   */
  async handleProjectSelection(ctx: Context, projectId: number): Promise<void> {
    const tgUser = ctx.from;
    if (!tgUser) return;

    // Get user language preference
    const user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    const language = user?.language || 'en';

    // Update user state to in-project
    this.userStateMap.set(tgUser.id, {
      state: UserState.IN_PROJECT,
      currentProjectId: projectId,
    });

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: [
        'timeSlots',
        'timeSlots.user',
        'timeSlots.createdBy',
        'timeSlots.participantFor',
      ],
    });

    if (!project) {
      await ctx.reply(translate(language, 'projectNotFound'));
      await this.showProjectList(ctx);
      return;
    }

    // Display project info
    let message = `📋 ${translate(language, 'project')}: ${project.name}\n\n`;
    if (project.description) {
      message += `${translate(language, 'description')}: ${project.description}\n\n`;
    }

    if (project.timeSlots && project.timeSlots.length > 0) {
      message += `${translate(language, 'existingTimeslots')}:\n`;

      // Group the time slots by user for better organization
      const timeSlotsByUser = project.timeSlots.reduce(
        (acc, slot) => {
          const userId = slot.participantFor?.id || slot.user?.id || 'unknown';
          if (!acc[userId]) {
            acc[userId] = [];
          }
          acc[userId].push(slot);
          return acc;
        },
        {} as Record<string, TimeSlot[]>,
      );

      // List time slots by user
      for (const userId in timeSlotsByUser) {
        const slots = timeSlotsByUser[userId];
        if (slots.length > 0) {
          const userName =
            slots[0].participantFor?.firstName ||
            slots[0].user?.firstName ||
            slots[0].participantFor?.username ||
            slots[0].user?.username ||
            translate(language, 'unknown');

          message += `\n${userName}'s ${translate(language, 'timeslots')}:\n`;

          slots.forEach((slot) => {
            // Add lock indicator if the slot is locked
            const lockIcon = slot.isLocked ? '🔒 ' : '';
            // Show who created the slot if it's for someone else
            let creatorInfo = '';
            if (
              slot.createdBy &&
              slot.participantFor &&
              slot.createdBy.id !== slot.participantFor.id
            ) {
              creatorInfo = ` (${translate(language, 'createdBy')} ${slot.createdBy.firstName || slot.createdBy.username})`;
            }

            message += `• ${lockIcon}${new Date(slot.startTime).toLocaleString()} - ${new Date(slot.endTime).toLocaleString()}${creatorInfo}\n`;
          });
        }
      }
    } else {
      message += translate(language, 'noTimeslots');
    }

    message += `\n${translate(language, 'sendAvailabilityInstructions')}`;

    const webAppUrl =
      this.configService.get<string>('WEBAPP_URL') + `/project/${projectId}`;

    // Original keyboard without slot toggle buttons
    await ctx.reply(
      message,
      Markup.inlineKeyboard(
        [
          Markup.button.url(translate(language, 'openMiniApp'), webAppUrl),
          Markup.button.callback(
            translate(language, 'editTimeslots'),
            'edit_timeslots',
          ),
          Markup.button.callback(
            translate(language, 'backToProjects'),
            'back_to_projects',
          ),
        ],
        { columns: 1 },
      ),
    );
  }

  /**
   * Handle editing timeslots
   */
  async handleEditTimeslots(ctx: Context): Promise<void> {
    const tgUser = ctx.from;
    if (!tgUser) return;

    // Get user language preference
    const user = await this.userRepository.findOne({
      where: { telegramId: tgUser.id },
    });
    const language = user?.language || 'en';

    const userState = this.userStateMap.get(tgUser.id);
    if (!userState || !userState.currentProjectId) {
      await ctx.reply(translate(language, 'noProjectSelected'));
      await this.showProjectList(ctx);
      return;
    }

    // Set state to editing timeslot
    this.userStateMap.set(tgUser.id, {
      ...userState,
      state: UserState.EDITING_TIMESLOT,
    });

    const webAppUrl =
      this.configService.get<string>('WEBAPP_URL') +
      `/project/${userState.currentProjectId}/timeslots`;

    await ctx.reply(
      translate(language, 'editTimeslotsInApp'),
      Markup.inlineKeyboard([
        Markup.button.url(translate(language, 'editTimeslots'), webAppUrl),
        Markup.button.callback(
          translate(language, 'backToProject'),
          `project:${userState.currentProjectId}`,
        ),
      ]),
    );
  }
}
