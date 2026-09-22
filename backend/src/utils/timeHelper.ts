/**
 * Centralized Timezone & Date Helper for Lakshya Smart Library
 * Enforces authoritative Asia/Kolkata (IST: UTC+05:30) display & formatting.
 *
 * NOTE: MongoDB Date values remain standard UTC timestamps in the database.
 * Conversions to IST occur solely during rendering, export, or date partitioning.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns YYYY-MM-DD in Asia/Kolkata timezone.
 * Guarantees date does not drift around midnight due to UTC offset differences.
 */
export const getISTDateString = (d: Date | string | number = new Date()): string => {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
};

/**
 * Formats a Date or timestamp string into 12-hour clock format (hh:mm A) in Asia/Kolkata.
 * Example: '11:53 AM', '06:33 PM'
 */
export const formatISTTime = (d: Date | string | number | null | undefined): string => {
  if (!d) return '--';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
};

/**
 * Formats a Date into a human-readable IST string.
 * Example: 'Monday, 22 Sep 2026' or '22 Sep 2026'
 */
export const formatISTDateDisplay = (
  d: Date | string | number | null | undefined,
  includeWeekday = false
): string => {
  if (!d) return '--';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '--';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  };
  if (includeWeekday) {
    options.weekday = 'short';
  }

  return new Intl.DateTimeFormat('en-IN', options).format(dateObj);
};

/**
 * Formats date and time together in IST.
 * Example: '22 Sep 2026, 11:53 AM'
 */
export const formatISTDateTime = (d: Date | string | number | null | undefined): string => {
  if (!d) return '--';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '--';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
};

/**
 * Calculates duration between actual entry and exit timestamps.
 * Does NOT calculate from pre-formatted strings.
 * Returns formatted string: 'Xh Ym' (e.g. '6h 40m') or '--'
 */
export const calculateDurationString = (
  entryTime: Date | string | number | null | undefined,
  exitTime?: Date | string | number | null | undefined,
  storedDurationMinutes?: number
): string => {
  if (!entryTime) return '--';
  const entryMs = (entryTime instanceof Date ? entryTime : new Date(entryTime)).getTime();

  if (exitTime) {
    const exitMs = (exitTime instanceof Date ? exitTime : new Date(exitTime)).getTime();
    if (!isNaN(entryMs) && !isNaN(exitMs) && exitMs >= entryMs) {
      const diffMinutes = Math.max(0, Math.round((exitMs - entryMs) / 60000));
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hours}h ${mins < 10 ? '0' : ''}${mins}m`;
    }
  }

  if (storedDurationMinutes !== undefined && storedDurationMinutes !== null && storedDurationMinutes >= 0) {
    const hours = Math.floor(storedDurationMinutes / 60);
    const mins = storedDurationMinutes % 60;
    return `${hours}h ${mins < 10 ? '0' : ''}${mins}m`;
  }

  return '--';
};
