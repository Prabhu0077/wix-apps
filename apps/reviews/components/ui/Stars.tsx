// Read-only star row. Colours come from CSS (--star-on / --star-off) so the
// dashboard and the storefront widget can each set their own.

const STAR_PATH =
  "M10 1.6l2.47 5.3 5.8.68-4.29 3.96 1.13 5.73L10 14.4l-5.11 2.87 1.13-5.73L1.73 7.58l5.8-.68z";

type Props = { rating: number; size?: number; label?: boolean };

export function Stars({ rating, size = 16, label = true }: Props) {
  const rounded = Math.round(rating);
  return (
    <span
      className="stars"
      role={label ? "img" : undefined}
      aria-label={label ? `${rating.toFixed(1)} out of 5 stars` : undefined}
      aria-hidden={label ? undefined : true}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
          <path d={STAR_PATH} className={n <= rounded ? "star-on" : "star-off"} />
        </svg>
      ))}
    </span>
  );
}
