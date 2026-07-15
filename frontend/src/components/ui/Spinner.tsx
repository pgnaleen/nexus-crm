interface SpinnerProps {
  size?: number;
  color?: string;
  trackColor?: string;
  /** Full orbit duration in seconds. */
  speed?: number;
}

/**
 * Brand-aligned loading indicator: a static ring (echoing the Orelia logo
 * mark) with a glowing dot continuously orbiting around it.
 */
export function Spinner({
  size = 20,
  color = "#2f6feb",
  trackColor = "rgba(26, 39, 68, 0.12)",
  speed = 0.9,
}: SpinnerProps) {
  const strokeWidth = size * 0.14;
  const r = size / 2 - strokeWidth / 2;
  const dotR = size * 0.12;
  const dotTop = strokeWidth / 2 - dotR;

  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ position: "relative", display: "inline-block", width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          animation: `spinner-rotate ${speed}s linear infinite`,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: dotTop,
            left: "50%",
            width: dotR * 2,
            height: dotR * 2,
            marginLeft: -dotR,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 ${dotR * 1.5}px ${color}99`,
          }}
        />
      </span>
    </span>
  );
}
