"use client";

// Shopper-facing review form, opened from the review request email.
// It belongs to the merchant's store: store name first, neutral styling, no
// app branding beyond the footer line. No login — the token is the proof.
//
// One block per product in the order. The shopper rates any products they
// want to review and can skip the rest; each rated product becomes its own
// review. Up to 5 photos per product, uploaded straight to Cloudflare R2;
// the photo picker appears only when R2 is configured (photosEnabled).

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { REVIEW_LINK_DAYS } from "@/lib/product";

type Product = { id: string; name: string; imageUrl?: string };
type Context = { storeName: string | null; products: Product[]; photosEnabled?: boolean };
type Photo = { key: string; preview: string };
type Draft = { rating: number; body: string; photos: Photo[] };

const LOAD_ERRORS: Record<string, string> = {
  not_found: "This review link doesn't work. Check that you opened the full link from the email.",
  expired: `This review link has expired. Links work for ${REVIEW_LINK_DAYS} days after the email is sent.`,
  already_submitted: "You've already sent a review for this order. Thank you.",
};

const RATING_WORDS = ["", "Poor", "Fair", "Okay", "Good", "Excellent"];
const STAR_PATH =
  "M10 1.6l2.47 5.3 5.8.68-4.29 3.96 1.13 5.73L10 14.4l-5.11 2.87 1.13-5.73L1.73 7.58l5.8-.68z";
const MIN_TEXT = 10;
const EMPTY: Draft = { rating: 0, body: "", photos: [] };
const MAX_PHOTOS = 5;
const MAX_PHOTO_MB = 10;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Ask our server for a signed URL, then upload the file straight to storage. */
async function uploadPhoto(token: string, file: File): Promise<Photo> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error("Use a JPG, PNG or WebP photo.");
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) throw new Error(`Photos can be up to ${MAX_PHOTO_MB} MB.`);
  const sig = await fetch("/api/public/review/upload-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, contentType: file.type, sizeBytes: file.size }),
  });
  if (!sig.ok) throw new Error("Photo upload isn't available right now.");
  const { uploadUrl, key } = (await sig.json()) as { uploadUrl: string; key: string };
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("A photo didn't upload. Try again.");
  return { key, preview: URL.createObjectURL(file) };
}

function PhotoPicker({
  token,
  idPrefix,
  photos,
  onChange,
}: {
  token: string;
  idPrefix: string;
  photos: Photo[];
  onChange: (next: Photo[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setProblem(null);
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) setProblem(`You can add up to ${MAX_PHOTOS} photos.`);
    setBusy(true);
    const added: Photo[] = [];
    for (const f of picked) {
      try {
        added.push(await uploadPhoto(token, f));
      } catch (e) {
        setProblem(e instanceof Error ? e.message : "A photo didn't upload.");
      }
    }
    setBusy(false);
    if (added.length) onChange([...photos, ...added]);
  }

  return (
    <div className="rf-field">
      <span className="rf-label" id={`${idPrefix}-photos-label`}>
        Photos <span className="rf-hint">(optional, up to {MAX_PHOTOS})</span>
      </span>
      {photos.length > 0 && (
        <ul className="rf-photos" aria-labelledby={`${idPrefix}-photos-label`}>
          {photos.map((ph, i) => (
            <li key={ph.key}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.preview} alt={`Your photo ${i + 1}`} />
              <button
                type="button"
                className="rf-photo-remove"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange(photos.filter((x) => x.key !== ph.key))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {photos.length < MAX_PHOTOS && (
        <label className="rf-photo-add">
          <input
            type="file"
            accept={PHOTO_TYPES.join(",")}
            multiple
            disabled={busy}
            onChange={(e) => {
              void add(e.target.files);
              e.target.value = "";
            }}
          />
          {busy ? "Uploading…" : photos.length ? "Add more photos" : "Add photos"}
        </label>
      )}
      {problem && <p className="rf-item-error">{problem}</p>}
    </div>
  );
}

function StarInput({
  idPrefix,
  label,
  value,
  onChange,
}: {
  idPrefix: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset className="rf-field rf-fieldset">
      <legend className="rf-label">{label}</legend>
      <div className="rate" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>
            <input
              type="radio"
              id={`${idPrefix}-star-${n}`}
              name={`${idPrefix}-rating`}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <label
              htmlFor={`${idPrefix}-star-${n}`}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}, ${RATING_WORDS[n]}`}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d={STAR_PATH} className={n <= shown ? "star-on" : "star-off"} />
              </svg>
            </label>
          </span>
        ))}
      </div>
      <p className="rate-word" aria-live="polite">
        {RATING_WORDS[shown]}
      </p>
    </fieldset>
  );
}

export default function ReviewFormPage() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<Context | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/public/review/${token}`)
      .then((r) => r.json())
      .then((d: Context & { error?: string }) => {
        if (d.error) setLoadError(LOAD_ERRORS[d.error] ?? "We couldn't open this review form. Try the link again later.");
        else setCtx(d);
      })
      .catch(() => setLoadError("We couldn't open this review form. Check your connection and try again."));
  }, [token]);

  const draft = (id: string): Draft => drafts[id] ?? EMPTY;
  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? EMPTY), ...patch } }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx) return;
    const single = ctx.products.length === 1;

    // A product counts as started once it has a rating, some text or a photo.
    const started = ctx.products.filter(
      (p) => draft(p.id).rating > 0 || draft(p.id).body.trim() !== "" || draft(p.id).photos.length > 0,
    );
    const found: Record<string, string> = {};
    for (const p of started) {
      const d = draft(p.id);
      if (d.rating === 0) found[p.id] = "Choose a star rating.";
      else if (d.body.trim().length < MIN_TEXT) found[p.id] = `Write at least a sentence (${MIN_TEXT} characters or more).`;
    }
    setProblems(found);

    if (started.length === 0) {
      return setError(single ? "Choose a star rating." : "Rate at least one product.");
    }
    const problemCount = Object.keys(found).length;
    if (problemCount > 0) {
      return setError(single ? Object.values(found)[0] : `Check the highlighted product${problemCount > 1 ? "s" : ""}.`);
    }
    if (!name.trim()) return setError("Add the name you'd like shown with your review.");

    setSending(true);
    setError(null);
    const res = await fetch(`/api/public/review/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name.trim(),
        items: started.map((p) => ({
          productId: p.id,
          rating: draft(p.id).rating,
          body: draft(p.id).body.trim(),
          mediaKeys: draft(p.id).photos.map((ph) => ph.key),
        })),
      }),
    }).catch(() => null);

    if (res?.ok) {
      const data = (await res.json().catch(() => ({}))) as { saved?: number };
      setSavedCount(data.saved ?? started.length);
      return;
    }
    const code = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : undefined;
    setError(
      code === "already_submitted"
        ? LOAD_ERRORS.already_submitted
        : code === "expired"
          ? LOAD_ERRORS.expired
          : "Your review didn't send. Check your connection and try again.",
    );
    setSending(false);
  }

  const store = ctx?.storeName ?? "the store";
  const sent = savedCount !== null;
  const single = ctx?.products.length === 1;

  return (
    <main className="rf">
      {ctx && <p className="rf-store">{store}</p>}
      <h1 className="rf-title">{sent ? "Thanks for your review" : "How was your order?"}</h1>

      <div className="rf-card">
        {loadError ? (
          <p>{loadError}</p>
        ) : !ctx ? (
          <p className="rf-hint">Loading…</p>
        ) : sent ? (
          <div className="rf-done">
            <h2>
              {savedCount === 1 ? "Your review has" : `Your ${savedCount} reviews have`} been sent to {store}.
            </h2>
            <p className="rf-hint">Reviews appear on the product page once the store publishes them.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="rf-form">
            {!single && (
              <p className="rf-hint">Rate any product you&apos;d like to review. You can skip the others.</p>
            )}

            {ctx.products.map((p, i) => {
              const d = draft(p.id);
              const problem = problems[p.id];
              return (
                <section
                  key={p.id}
                  className={`rf-item${single ? " rf-item-single" : ""}${problem ? " rf-item-problem" : ""}`}
                  aria-labelledby={`p${i}-name`}
                >
                  <div className="rf-product">
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" />
                    )}
                    <span className="rf-product-name" id={`p${i}-name`}>
                      {p.name}
                    </span>
                  </div>

                  <StarInput
                    idPrefix={`p${i}`}
                    label={single ? "Your rating" : `Your rating for ${p.name}`}
                    value={d.rating}
                    onChange={(n) => update(p.id, { rating: n })}
                  />

                  <div className="rf-field">
                    <label className="rf-label" htmlFor={`p${i}-review`}>
                      Your review
                    </label>
                    <textarea
                      id={`p${i}-review`}
                      className="rf-textarea"
                      maxLength={5000}
                      value={d.body}
                      onChange={(e) => update(p.id, { body: e.target.value })}
                      placeholder="What did you like or dislike? How are you using it?"
                      aria-invalid={problem ? true : undefined}
                      aria-describedby={problem && !single ? `p${i}-problem` : undefined}
                    />
                  </div>

                  {ctx.photosEnabled && (
                    <PhotoPicker
                      token={token}
                      idPrefix={`p${i}`}
                      photos={d.photos}
                      onChange={(photos) => update(p.id, { photos })}
                    />
                  )}

                  {problem && !single && (
                    <p className="rf-item-error" id={`p${i}-problem`}>
                      {problem}
                    </p>
                  )}
                </section>
              );
            })}

            <div className="rf-field">
              <label className="rf-label" htmlFor="name">
                Name shown with your review{single ? "" : "s"}
              </label>
              <input
                id="name"
                className="rf-input"
                maxLength={120}
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya S."
              />
              <p className="rf-hint">Your email address is never shown.</p>
            </div>

            {error && (
              <p className="rf-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="rf-submit" disabled={sending}>
              {sending ? "Sending…" : single ? "Send review" : "Send reviews"}
            </button>
          </form>
        )}
      </div>

      <p className="rf-note">
        Your review goes to {store}. The store may reply publicly. <a href="/privacy">Privacy</a>
      </p>
    </main>
  );
}
