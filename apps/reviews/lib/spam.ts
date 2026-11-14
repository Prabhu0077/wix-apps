// Rule-based checks on shopper text (free plan, no AI cost). A flagged
// review is held for the merchant even when auto-publish is on. Rules look
// at content only, never at the rating, so this is not review gating.

// Scheme or "www." in any case; bare domains only in lower case, so a missed
// space after a full stop ("great product.In use daily") is not a link.
// Bare ".in"/".co" are left out for the same reason ("good product.in budget").
const LINK_PREFIX = /(https?:\/\/|www\.)/i;
const LINK_DOMAIN = /\b[a-z0-9-]{2,}\.(com|net|org|io|ru|xyz|top|shop|info|link|click|co\.in|co\.uk)\b/;
const CONTACT = /([\w.+-]+@[\w-]+\.[\w.]+)|(\+?\d[\d\s-]{8,}\d)/;
// Short on purpose: obvious slurs and spam words. Extend in one place.
const BLOCKED = [
  "fuck", "shit", "bitch", "bastard", "cunt", "nigger", "faggot", "retard",
  "chutiya", "madarchod", "bhenchod", "behenchod",
  "viagra", "casino", "crypto giveaway", "bitcoin", "loan offer", "escort",
];

// Whole words plus common endings: "retarded" matches, "flame retardant" doesn't.
const BLOCKED_RE = new RegExp(`\\b(${BLOCKED.map((w) => w.replace(/ /g, "\\s+")).join("|")})(s|es|ed|er|ing|y)?\\b`, "i");

export type SpamFlag = "link" | "contact_details" | "bad_language" | "shouting" | "repeated_text";

export const SPAM_FLAG_LABEL: Record<SpamFlag, string> = {
  link: "Contains a link",
  contact_details: "Contains an email or phone number",
  bad_language: "Contains offensive or spam words",
  shouting: "Mostly capital letters",
  repeated_text: "Repeated characters or words",
};

export function spamFlags(text: string, name = ""): SpamFlag[] {
  const flags: SpamFlag[] = [];
  const all = `${name} ${text}`;
  const lower = all.toLowerCase();
  if (LINK_PREFIX.test(all) || LINK_DOMAIN.test(all)) flags.push("link");
  if (CONTACT.test(text)) flags.push("contact_details");
  if (BLOCKED_RE.test(lower)) flags.push("bad_language");
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 20 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7) flags.push("shouting");
  const words = lower.split(/\s+/).filter(Boolean);
  const top = Math.max(0, ...Object.values(words.reduce<Record<string, number>>((m, w) => ((m[w] = (m[w] ?? 0) + 1), m), {})));
  if (/(.)\1{6,}/.test(text) || (words.length >= 6 && top / words.length > 0.5)) flags.push("repeated_text");
  return flags;
}
