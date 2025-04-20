/**
 * Preset colors for time slots
 * These colors will be assigned to users by default
 */
export const PRESET_COLORS = [
  '#FF5733', // Coral
  '#33FF57', // Light Green
  '#3357FF', // Royal Blue
  '#FF33F5', // Pink
  '#F5FF33', // Yellow
  '#33FFF5', // Cyan
  '#FF8333', // Orange
  '#8333FF', // Purple
  '#33A0FF', // Light Blue
  '#FF3333', // Red
];

/**
 * Get a color from the preset list based on an ID
 * This ensures that the same ID always gets the same color
 * @param id The ID to use for determining the color (usually user ID)
 * @returns A color from the preset list
 */
export function getColorForId(id: number): string {
  return PRESET_COLORS[id % PRESET_COLORS.length];
}
