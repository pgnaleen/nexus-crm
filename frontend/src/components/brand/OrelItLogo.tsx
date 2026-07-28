interface OrelItLogoProps {
  /** Cap height of the wordmark in px. */
  size?: number;
  className?: string;
}

/**
 * The Orel IT vendor wordmark — "OREL" in brand red, "IT" in near-black.
 *
 * Unlike NexusLogo this is set as styled text, not traced vector paths: the
 * logo was supplied as a raster image, so there was no vector data to inline.
 * It is a close match (the mark is a two-colour wordmark and nothing else),
 * but it is an approximation, and the letterforms follow the system font
 * stack rather than the real typeface.
 *
 * If the true SVG turns up, drop it in `brand-assets/` and swap this
 * component's body for inlined paths the way NexusLogo does — the call sites
 * and the props below don't need to change.
 */
export function OrelItLogo({ size = 13, className }: OrelItLogoProps) {
  return (
    <span
      className={`inline-flex items-baseline font-bold leading-none ${className ?? ""}`}
      style={{ fontSize: size, letterSpacing: "-0.01em" }}
    >
      {/* Red here is a logo, not UI chrome, so it is exempt from the rule that
          confines the primary to buttons/nav/badges/focus rings -- but it still
          reads from the token so a re-brand reaches it. */}
      <span style={{ color: "var(--color-crm-primary)" }}>OREL</span>
      <span style={{ color: "#252525", marginLeft: size * 0.16 }}>IT</span>
    </span>
  );
}
