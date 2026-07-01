// The MosqueOS mark: an eight-point star formed by two overlapping squares —
// the same construction (rub' el hizb) used across mosque tilework and
// manuscript illumination, drawn as a single clean line rather than a dense
// tessellation. Used sparingly: the sidebar/login wordmark and, faintly, as
// a watermark on the login page. Never repeated as busy background texture
// on the working screens.
export function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2.5 L15.2 8.8 L21.5 12 L15.2 15.2 L12 21.5 L8.8 15.2 L2.5 12 L8.8 8.8 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
