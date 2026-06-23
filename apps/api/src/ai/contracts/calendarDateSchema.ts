import { z } from "zod";

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const isValidCalendarDate = (value: string) => {
  if (!calendarDatePattern.test(value)) {
    return false;
  }

  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const calendarDateSchema = z
  .string()
  .regex(calendarDatePattern)
  .refine(isValidCalendarDate, "Must be a valid calendar date");
