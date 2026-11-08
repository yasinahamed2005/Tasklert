import React from "react";

/**
 * Tasklert Circular Brand Icon Component
 * Vector SVG with gradient ring, T-stem symbol, and alert bell node.
 */
export const TasklertIcon = ({ size = 36, className = "", idPrefix = "tl" }) => {
  const reactId = React.useId ? React.useId().replace(/[:]/g, "_") : Math.random().toString(36).substring(2, 7);
  const uniquePrefix = `${idPrefix}_${reactId}`;
  const bgGradId = `${uniquePrefix}-bgGrad`;
  const ringGradId = `${uniquePrefix}-ringGrad`;
  const tGradId = `${uniquePrefix}-tGrad`;
  const bellGradId = `${uniquePrefix}-bellGrad`;
  const shadowId = `${uniquePrefix}-shadow`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      className={`shrink-0 block ${className}`}
      role="img"
      aria-label="Tasklert logo icon"
    >
      <defs>
        {/* Tasklert Royal Purple to Magenta Gradient */}
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="35%" stopColor="#7e22ce" />
          <stop offset="75%" stopColor="#c026d3" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>

        {/* Subtle Premium Ring Highlight */}
        <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.45)" />
          <stop offset="50%" stopColor="rgba(255, 255, 255, 0.12)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0.02)" />
        </linearGradient>

        {/* T-Symbol Gradient */}
        <linearGradient id={tGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f5d0fe" />
        </linearGradient>

        {/* Bell Alert Gradient */}
        <linearGradient id={bellGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fae8ff" />
        </linearGradient>

        {/* Soft Drop Shadow */}
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#2e1065" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Circular Outer Container */}
      <circle
        cx="50"
        cy="50"
        r="46"
        fill={`url(#${bgGradId})`}
        stroke={`url(#${ringGradId})`}
        strokeWidth="1.5"
      />

      {/* Stylized Modern Letter T */}
      <path
        d="M 24 28 C 24 24.5, 27 23, 31 23 L 69 23 C 73 23, 76 24.5, 76 28 C 76 31.5, 73 33, 69 33 L 55.5 33 L 55.5 69 C 55.5 73, 51.5 76, 46.5 76 C 41.5 76, 37.5 73, 37.5 69 L 37.5 33 L 31 33 C 27 33, 24 31.5, 24 28 Z"
        fill={`url(#${tGradId})`}
      />

      {/* T-Stem Glass Highlight */}
      <path
        d="M 37.5 33 L 37.5 69 C 37.5 73, 41.5 76, 46.5 76 C 51.5 76, 55.5 73, 55.5 69 L 55.5 33 Z"
        fill="#ffffff"
        fillOpacity="0.12"
      />

      {/* Integrated Alert Bell & Waves */}
      <g filter={`url(#${shadowId})`}>
        {/* Bell Body */}
        <path
          d="M 64.5 45 C 64.5 43.5, 63 42, 60.5 42 C 58 42, 56.5 43.5, 56.5 45 C 56.5 46.2, 54.5 48.5, 53 53.5 C 52 57, 51.5 59.5, 51.5 60.5 C 51.5 61.5, 52.5 62, 54 62 L 67 62 C 68.5 62, 69.5 61.5, 69.5 60.5 C 69.5 59.5, 69 57, 68 53.5 C 66.5 48.5, 64.5 46.2, 64.5 45 Z"
          fill={`url(#${bellGradId})`}
        />
        {/* Clapper */}
        <path d="M 58 63.2 C 58 65.2, 59.1 66.5, 60.5 66.5 C 61.9 66.5, 63 65.2, 63 63.2 Z" fill="#ffffff" />
        {/* Wave 1 */}
        <path
          d="M 72.5 48.5 C 75.8 52, 75.8 57, 72.5 60.5"
          fill="none"
          stroke="#f472b6"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Wave Dot */}
        <circle cx="76.5" cy="46" r="2" fill="#fb7185" />
      </g>
    </svg>
  );
};

/**
 * Tasklert Horizontal Brand Lockup Component (Icon + Text)
 */
export const TasklertLogo = ({
  size = 36,
  textSize = "text-2xl",
  textColor = "text-[color:var(--text-strong)]",
  showText = true,
  className = "",
  idPrefix,
  onClick,
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2.5 shrink-0 ${onClick ? "cursor-pointer group" : ""} ${className}`}
      onClick={onClick}
    >
      <div
        className="shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        <TasklertIcon size={size} idPrefix={idPrefix || "tllogo"} />
      </div>

      {showText && (
        <span
          className={`${textSize} font-extrabold tracking-tight ${textColor}`}
          style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}
        >
          Tasklert
        </span>
      )}
    </div>
  );
};

/**
 * Tasklert Mail Circular Brand Icon Component
 * Combines the clean envelope shape from the user's reference with Tasklert's brand gradient ring & styling.
 */
export const TasklertMailIcon = ({ size = 38, className = "", idPrefix = "tl-mail" }) => {
  const bgGradId = `${idPrefix}-bgGrad`;
  const ringGradId = `${idPrefix}-ringGrad`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="Tasklert Mail logo"
    >
      <defs>
        {/* Tasklert Royal Purple to Emerald Mail Gradient */}
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="45%" stopColor="#7e22ce" />
          <stop offset="85%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        {/* Highlight Ring */}
        <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.6)" />
          <stop offset="60%" stopColor="rgba(255, 255, 255, 0.15)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
        </linearGradient>
      </defs>

      {/* Circular Outer Container with Tasklert Brand Gradient */}
      <circle
        cx="50"
        cy="50"
        r="46"
        fill={`url(#${bgGradId})`}
        stroke={`url(#${ringGradId})`}
        strokeWidth="1.5"
      />

      {/* Simple Modern Mail Envelope (Image 2 reference) */}
      <rect
        x="23"
        y="30"
        width="54"
        height="40"
        rx="9"
        fill="rgba(255, 255, 255, 0.12)"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Flap V-Line */}
      <path
        d="M 27 35 L 50 52 L 73 35"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Brand Accent Dot */}
      <circle cx="70" cy="34" r="3.5" fill="#34d399" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
};

/**
 * Simple Clean Outline Mail Icon (Matches Image 2 reference directly)
 */
export const SimpleMailIcon = ({ size = 20, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="4" width="20" height="16" rx="4" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export default TasklertLogo;
