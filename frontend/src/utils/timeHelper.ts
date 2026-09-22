/**
 * Centralized Timezone & Date Helper for Lakshya Smart Library Frontend
 * Guarantees consistent Asia/Kolkata (IST: UTC+05:30) rendering across all client browsers and devices.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns YYYY-MM-DD in Asia/Kolkata timezone.
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
 * Formats a Date or ISO timestamp into 12-hour clock format (hh:mm A) in Asia/Kolkata.
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
 * Example: '22 Sep 2026' or 'Mon, 22 Sep 2026'
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
 * Formats elapsed duration from entry timestamp to now.
 */
export const formatElapsedDuration = (entryTime: Date | string | number | null | undefined): string => {
  if (!entryTime) return '--';
  const entryMs = (entryTime instanceof Date ? entryTime : new Date(entryTime)).getTime();
  if (isNaN(entryMs)) return '--';
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - entryMs) / 60000));
  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;
  return `${hours}h ${mins < 10 ? '0' : ''}${mins}m`;
};
