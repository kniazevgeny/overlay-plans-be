/**
 * Types related to user state management in the Telegram bot
 */

/**
 * Enum representing the possible states of a user in the Telegram bot
 */
export enum UserState {
  INITIAL = 'initial',
  AWAITING_PROJECT_SELECTION = 'awaiting_project_selection',
  IN_PROJECT = 'in_project',
  PROCESSING_MESSAGE = 'processing_message',
  EDITING_TIMESLOT = 'editing_timeslot',
}

/**
 * Represents data for a time slot
 */
export interface TimeSlotData {
  startTime: string;
  endTime: string;
  notes?: string;
  status?: 'available' | 'busy'; // Status of the time slot
}

/**
 * User state data with support for dynamic properties
 */
export interface UserStateData {
  state: UserState;
  currentProjectId?: number;
  pendingTimeSlots?: { [key: string]: TimeSlotData[] };
  mentionedUsers?: { [key: string]: number | null }; // Maps message text to user IDs
  [key: string]: any; // For other dynamic properties
}
