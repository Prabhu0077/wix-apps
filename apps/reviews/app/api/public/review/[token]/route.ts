// Public review submission endpoint. Unauthenticated — token is the only
// proof the request is legitimate. Treat all input as hostile.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

// GET — fetch the prompt context (product info, customer name) for the form.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // TODO: look up ReviewRequest by publicToken; return the customer name
  // and product summaries needed to render the submission form.
  return NextResponse.json({
    token,
    status: "stub",
    products: [],
  });
}

const SubmitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body:   z.string().min(1).max(5000),
  customerName: z.string().min(1).max(120),
  // Media is uploaded directly to R2 via signed URL — the client sends back the keys.
  mediaKeys: z.array(z.string()).max(6).optional(),
});

// POST — actual review submission.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body;
  try {
    body = SubmitSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "validation_failed", detail: String(err) }, { status: 400 });
  }

  // TODO:
  //   1. Look up ReviewRequest by token; reject if missing or expired.
  //   2. Insert Review (status: PENDING) + ReviewMedia rows.
  //   3. Mark ReviewRequest as COMPLETED.
  //   4. Enqueue AI moderation.
  //   5. Send confirmation email to customer.
  return NextResponse.json({ token, received: body, status: "stub_accepted" });
}
