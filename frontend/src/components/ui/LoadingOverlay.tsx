import { Spinner } from "./Spinner";

interface LoadingOverlayProps {
  label?: string;
}

/** Full-page centered loading state — dims/blurs the page behind it. */
export function LoadingOverlay({ label }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-overlay-content">
        <Spinner size={40} />
        {label && <p className="loading-overlay-label">{label}</p>}
      </div>
    </div>
  );
}
