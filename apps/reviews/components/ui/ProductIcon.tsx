// The app's own mark: a speech bubble holding a star — "what customers say".
// Used in the dashboard header and on the support page; never on storefronts.

export function ProductIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#116DFF" />
      <path
        d="M8 9.5A2.5 2.5 0 0 1 10.5 7h11A2.5 2.5 0 0 1 24 9.5v8a2.5 2.5 0 0 1-2.5 2.5H15l-4.2 3.6c-.5.4-1.3.1-1.3-.6V20h0A1.5 1.5 0 0 1 8 18.5z"
        fill="#fff"
      />
      <path
        d="m16 9.6 1.3 2.7 3 .4-2.2 2.1.5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.2-2.1 3-.4z"
        fill="#F5A623"
      />
    </svg>
  );
}
