import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * DEEP-WARN-021: Helper to format dates using tenant timezone.
 */
export function formatDate(
  date: string | Date,
  timezone: string = 'UTC',
  formatStr: string = 'dd MMM yyyy'
): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    const zoned = toZonedTime(d, timezone);
    return format(zoned, formatStr);
  } catch (err) {
    return 'Invalid Date';
  }
}

export function formatDateTime(
  date: string | Date,
  timezone: string = 'UTC'
): string {
  return formatDate(date, timezone, 'dd MMM yyyy HH:mm');
}
