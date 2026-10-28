import { formatDate } from "./format";
import { t } from "../i18n";

// Local date as yyyy-mm-dd; toISOString() would give yesterday before 05:30 IST.
function localToday() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

// A gentle warning when a payment or expense is dated in the past, so an
// old date is never picked by mistake. Returns "" for today.
export function backdateWarning(date) {
  if (!date) return "";
  const today = localToday();
  if (date >= today) return "";
  const days = Math.round((new Date(`${today}T00:00:00`) - new Date(`${date}T00:00:00`)) / 86400000);
  return days === 1
    ? t("This is for {date}, yesterday. Change the date if it was paid today.", { date: formatDate(date) })
    : t("This is for {date}, {days} days ago. Change the date if it was paid today.", { date: formatDate(date), days });
}
