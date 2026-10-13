// Per-store unsubscribe list for review request emails (task T1.6).
// Emails are matched by SHA-256 of the trimmed, lower-cased address.

import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";

import { db, emailSuppressions } from "@/lib/db";

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function isSuppressed(accountId: string, email: string): Promise<boolean> {
  const row = await db.query.emailSuppressions.findFirst({
    where: and(eq(emailSuppressions.accountId, accountId), eq(emailSuppressions.emailHash, hashEmail(email))),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function suppress(accountId: string, email: string, source: "link" | "one_click"): Promise<void> {
  await db
    .insert(emailSuppressions)
    .values({ accountId, emailHash: hashEmail(email), source })
    .onConflictDoNothing({ target: [emailSuppressions.accountId, emailSuppressions.emailHash] });
}
