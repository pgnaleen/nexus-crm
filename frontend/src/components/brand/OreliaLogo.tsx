interface OreliaLogoProps {
  /** Renders a white ring for dark backgrounds (e.g. the brand panel, sidebar/topbar). */
  dark?: boolean;
  /** Renders just the ring+dot mark, without the wordmark/tagline. */
  iconOnly?: boolean;
  /** Base size of the icon in px. */
  size?: number;
  showTagline?: boolean;
}

export function OreliaLogo({
  dark = false,
  iconOnly = false,
  size = 36,
  showTagline = true,
}: OreliaLogoProps) {
  const ringColor = dark ? "#ffffff" : "#1a2744";
  const dotColor = "#6aadff";
  const textColor = dark ? "#ffffff" : "#1a2744";
  const tagColor = "#6aadff";

  const strokeWidth = size * 0.13;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - strokeWidth / 2 - size * 0.04;
  const dotR = size * 0.14;
  // Position dot at top-right of ring: angle ~-50°
  const angle = -50 * (Math.PI / 180);
  const dotX = cx + r * Math.cos(angle);
  const dotY = cy + r * Math.sin(angle);

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <circle cx={cx} cy={cy} r={r} stroke={ringColor} strokeWidth={strokeWidth} fill="none" />
      <circle cx={dotX} cy={dotY} r={dotR} fill={dotColor} />
    </svg>
  );

  if (iconOnly) {
    return icon;
  }

  const fontSize = size * 0.72;
  const tagFontSize = size * 0.28;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.22 }}>
      {icon}
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          style={{
            fontSize,
            fontWeight: 700,
            color: textColor,
            letterSpacing: "-0.5px",
            lineHeight: 1,
          }}
        >
          Nexus CRM
        </span>
        {showTagline && (
          <span
            style={{
              fontSize: tagFontSize,
              fontWeight: 600,
              color: tagColor,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: size * 0.05,
            }}
          >
            By Orel IT
          </span>
        )}
      </div>
    </div>
  );
}
