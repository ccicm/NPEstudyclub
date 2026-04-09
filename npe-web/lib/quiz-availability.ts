const AEST_OFFSET_MINUTES = 10 * 60;
const QUIZ_OPEN_HOUR = 6;

type AestParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

function toAestParts(date: Date): AestParts {
  const shifted = new Date(date.getTime() + AEST_OFFSET_MINUTES * 60_000);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function fromAestParts(parts: Pick<AestParts, "year" | "month" | "day" | "hour" | "minute">) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour - 10, parts.minute, 0, 0));
}

function formatAestDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function isDailyQuizLive(now = new Date()) {
  const parts = toAestParts(now);
  return parts.weekday >= 1 && parts.weekday <= 5 && (parts.hour > QUIZ_OPEN_HOUR || parts.hour === QUIZ_OPEN_HOUR);
}

export function getNextDailyQuizOpen(now = new Date()) {
  const parts = toAestParts(now);

  if (parts.weekday >= 1 && parts.weekday <= 5 && parts.hour < QUIZ_OPEN_HOUR) {
    return fromAestParts({
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: QUIZ_OPEN_HOUR,
      minute: 0,
    });
  }

  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));

  if (parts.weekday === 5) {
    next.setUTCDate(next.getUTCDate() + 3);
  } else if (parts.weekday === 6) {
    next.setUTCDate(next.getUTCDate() + 2);
  } else if (parts.weekday === 0) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return fromAestParts({
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: QUIZ_OPEN_HOUR,
    minute: 0,
  });
}

export function getDailyQuizAvailabilityMessage(now = new Date()) {
  if (isDailyQuizLive(now)) {
    return null;
  }

  return `Daily quizzes unlock ${formatAestDateTime(getNextDailyQuizOpen(now))} AEST.`;
}

export function formatAestDateTimeForNotice(dateInput: string | Date) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return formatAestDateTime(date);
}