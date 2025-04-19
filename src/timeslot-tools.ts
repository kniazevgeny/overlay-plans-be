import { ChatCompletionTool } from 'openai/resources';

/**
 * MCP tools for timeslot management
 */
export const timeslotTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'project_add_timeslots',
      description: 'Create one or more new timeslots within a specific project',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'integer',
            description: 'The ID of the project to add timeslots to',
          },
          userId: {
            type: 'integer',
            description: 'The ID of the user these timeslots are for',
          },
          timeslots: {
            type: 'array',
            description: 'Array of timeslot objects to create',
            items: {
              type: 'object',
              properties: {
                startTime: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Start time of the timeslot (ISO 8601 format)',
                },
                endTime: {
                  type: 'string',
                  format: 'date-time',
                  description: 'End time of the timeslot (ISO 8601 format)',
                },
                notes: {
                  type: 'string',
                  description: 'Optional notes about the timeslot',
                },
                status: {
                  type: 'string',
                  enum: ['available', 'busy'],
                  description: 'Status of the timeslot (available or busy)',
                },
                isLocked: {
                  type: 'boolean',
                  description:
                    'Whether the timeslot should be locked (can only be modified by creator)',
                },
              },
              required: ['startTime', 'endTime', 'status'],
            },
          },
          createdById: {
            type: 'integer',
            description:
              'ID of the user creating these timeslots (if different from userId)',
          },
        },
        required: ['projectId', 'userId', 'timeslots'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_update_timeslots',
      description:
        'Update one or more existing timeslots within a specific project',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'integer',
            description: 'The ID of the project containing the timeslots',
          },
          timeslots: {
            type: 'array',
            description: 'Array of timeslot updates',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'The ID of the timeslot to update',
                },
                startTime: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Updated start time (ISO 8601 format)',
                },
                endTime: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Updated end time (ISO 8601 format)',
                },
                notes: {
                  type: 'string',
                  description: 'Updated notes',
                },
                status: {
                  type: 'string',
                  enum: ['available', 'busy'],
                  description: 'Updated status (available or busy)',
                },
                isLocked: {
                  type: 'boolean',
                  description: 'Updated lock status',
                },
              },
              required: ['id'],
            },
          },
          requestUserId: {
            type: 'integer',
            description:
              'ID of the user making the update request (for permission checking)',
          },
        },
        required: ['projectId', 'timeslots', 'requestUserId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_delete_timeslots',
      description: 'Delete one or more timeslots from a project',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'integer',
            description: 'The ID of the project containing the timeslots',
          },
          timeslotIds: {
            type: 'array',
            description: 'Array of timeslot IDs to delete',
            items: {
              type: 'integer',
            },
          },
          requestUserId: {
            type: 'integer',
            description:
              'ID of the user making the delete request (for permission checking)',
          },
        },
        required: ['projectId', 'timeslotIds', 'requestUserId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_merge_timeslots',
      description: 'Merge multiple time slots into one',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'integer',
            description: 'The ID of the project containing the timeslots',
          },
          timeslotIds: {
            type: 'array',
            description: 'Array of timeslot IDs to be merged',
            items: {
              type: 'integer',
            },
          },
          requestUserId: {
            type: 'integer',
            description:
              'ID of the user making the merge request (for permission checking)',
          },
          mergedNotes: {
            type: 'string',
            description:
              'Optional notes for the merged timeslot. If not provided, notes from original timeslots will be concatenated.',
          },
        },
        required: ['projectId', 'timeslotIds', 'requestUserId'],
      },
    },
  },
];
