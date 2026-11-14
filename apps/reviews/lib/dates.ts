// Review dates. Always show when the customer WROTE the review (createdAt;
// for imports, the original date the importer writes into createdAt) —
// never the publish date, which bunches up when a merchant approves many
// reviews at once and makes them all look written on the same day.

const DAY = 24 * 60 * 60 * 1000;

/** "Today", "Yesterday", "5 days ago", "3 weeks ago", then "12 Mar 2026". */
export function reviewDateLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / DAY);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 28) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  return fullDate(iso);
}

/** Unambiguous date for tooltips and older reviews, e.g. "12 Mar 2026". */
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
