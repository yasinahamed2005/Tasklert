import React, { useMemo } from "react";
import { Sprout, Coffee, Armchair, Sparkles } from "lucide-react";

/**
 * Tasklert Premium Liquid Timer Component
 * Fully reactive to all Tasklert themes (Lavender, Blue, Peach, Green, Pink, Dark)
 * 
 * Features:
 * - 3D Translucent Glass Orb with authentic specular highlights
 * - Breathing aura halo that animates dynamically
 * - Animated glowing circular progress ring with rounded caps
 * - Rotating orbital rim shimmer when running
 * - Dual-layer fluid sine wave liquid (front vibrant wave + back translucent wave)
 * - Micro-bubbles floating continuously through the liquid
 * - High-contrast readable typography matching active theme
 * - Completion celebration animation
 */
export const LiquidTimer = ({
  sessionType = "focus",
  remainingSeconds = 1500,
  totalSeconds = 1500,
  isRunning = false,
  isPaused = false,
  cycleCount = 0,
  totalCycles = 4,
  themePalette = null,
}) => {
  // Fallback palette if not explicitly provided
  const palette = useMemo(() => {
    if (themePalette) return themePalette;
    return {
      primary: "#8b5cf6",
      primaryDark: "#6d28d9",
      primaryLight: "#c4b5fd",
      primaryUltraLight: "#f5f3ff",
      primaryGlow: "rgba(139, 92, 246, 0.4)",
      gradientTop: "#a78bfa",
      gradientMid: "#8b5cf6",
      gradientBottom: "#5b21b6",
    };
  }, [themePalette]);

  // Format MM:SS
  const timeDisplay = useMemo(() => {
    const safeRemaining = Math.max(0, isFinite(remainingSeconds) ? remainingSeconds : totalSeconds);
    const mins = Math.floor(safeRemaining / 60);
    const secs = safeRemaining % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [remainingSeconds, totalSeconds]);

  // Elapsed percentage (0% to 100%)
  const isCompleted = remainingSeconds <= 0 && totalSeconds > 0;
  const progressPercent = useMemo(() => {
    if (!totalSeconds || totalSeconds <= 0) return 0;
    if (isCompleted) return 100;
    const elapsed = totalSeconds - Math.max(0, remainingSeconds);
    const pct = (elapsed / totalSeconds) * 100;
    return Math.max(14, Math.min(94, pct)); // Keep an aesthetically pleasing liquid reservoir visible
  }, [remainingSeconds, totalSeconds, isCompleted]);

  // Display cycle (1-based)
  const currentCycleDisplay = useMemo(() => {
    return Math.min(totalCycles, (cycleCount % totalCycles) + 1);
  }, [cycleCount, totalCycles]);

  // Mode label & icon
  const modeInfo = useMemo(() => {
    switch (sessionType) {
      case "short_break":
        return {
          label: "Short Break",
          icon: <Coffee className="w-5 h-5 text-amber-500 animate-pulse" />,
        };
      case "long_break":
        return {
          label: "Long Break",
          icon: <Armchair className="w-5 h-5 text-blue-500 animate-pulse" />,
        };
      case "focus":
      default:
        return {
          label: "Focus Session",
          icon: <Sprout className="w-5 h-5 text-emerald-500 animate-pulse" />,
        };
    }
  }, [sessionType]);

  // Water level Y position in SVG viewBox (0 is top, 100 is bottom)
  const waveY = useMemo(() => {
    if (isCompleted) return 0;
    return 96 - progressPercent * 0.82;
  }, [progressPercent, isCompleted]);

  // Progress arc calculation for the glowing rim ring
  const circumference = 2 * Math.PI * 46; // r=46 -> ~289.02
  const strokeDashoffset = useMemo(() => {
    if (!totalSeconds || totalSeconds <= 0) return circumference;
    const elapsed = totalSeconds - Math.max(0, remainingSeconds);
    const pct = Math.min(1, Math.max(0, elapsed / totalSeconds));
    return circumference - circumference * pct;
  }, [remainingSeconds, totalSeconds, circumference]);

  return (
    <div className="relative flex items-center justify-center select-none my-2 sm:my-3">
      {/* 1. Breathing Outer Glow Halo (Reactive to Theme) */}
      <div
        className="absolute w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${palette.primary} 0%, ${palette.primaryLight} 45%, transparent 75%)`,
          opacity: isRunning ? 0.38 : 0.22,
          transform: isRunning ? "scale(1.08)" : "scale(1)",
          animation: isRunning ? "pulseGlow 3.5s ease-in-out infinite" : "none",
        }}
      />

      {/* 2. Rotating Shimmer Orbital Ring around the Orb (Visible when running) */}
      {isRunning && (
        <div
          className="absolute w-72 h-72 sm:w-80 sm:h-80 md:w-88 md:h-88 rounded-full pointer-events-none"
          style={{
            border: `1.5px dashed ${palette.primaryLight}`,
            opacity: 0.35,
            animation: "spinSlow 20s linear infinite",
          }}
        />
      )}

      {/* 3. Main 3D Glass Sphere Container */}
      <div
        className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full p-2.5 sm:p-3 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-500 border"
        style={{
          background: "radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.82) 55%, rgba(240, 244, 255, 0.75) 100%)",
          borderColor: `color-mix(in srgb, ${palette.primary} 30%, #e2e8f0)`,
          boxShadow: `
            0 24px 50px -15px ${palette.primaryGlow},
            inset 0 3px 8px rgba(255, 255, 255, 0.95),
            inset 0 -6px 14px color-mix(in srgb, ${palette.primary} 15%, transparent)
          `,
        }}
      >
        {/* Animated Liquid Wave Reservoir */}
        <div className="absolute inset-2 sm:inset-2.5 rounded-full overflow-hidden bg-white/20 backdrop-blur-[2px]">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Back Wave Gradient (Lighter, Translucent) */}
              <linearGradient id={`liquidBack_${palette.primary.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={palette.gradientTop} stopOpacity="0.5" />
                <stop offset="50%" stopColor={palette.gradientMid} stopOpacity="0.65" />
                <stop offset="100%" stopColor={palette.gradientBottom} stopOpacity="0.8" />
              </linearGradient>

              {/* Front Wave Gradient (Deep, Vibrant Theme Color) */}
              <linearGradient id={`liquidFront_${palette.primary.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={palette.gradientTop} stopOpacity="0.85" />
                <stop offset="40%" stopColor={palette.gradientMid} stopOpacity="0.94" />
                <stop offset="100%" stopColor={palette.gradientBottom} stopOpacity="1" />
              </linearGradient>

              {/* Precise Circular Clip */}
              <clipPath id="circleClipOrb">
                <circle cx="50" cy="50" r="49" />
              </clipPath>
            </defs>

            <g clipPath="url(#circleClipOrb)">
              {/* Back Wave (Undulating with secondary rhythm for liquid depth) */}
              <path
                d={`M 0,${waveY + 2} Q 25,${waveY - 4} 50,${waveY + 2} T 100,${waveY + 2} L 100,100 L 0,100 Z`}
                fill={`url(#liquidBack_${palette.primary.replace("#", "")})`}
                className="transition-all duration-1000 ease-out"
              >
                {isRunning && (
                  <animate
                    attributeName="d"
                    dur="6.8s"
                    repeatCount="indefinite"
                    values={`
                      M 0,${waveY + 2} Q 25,${waveY - 4} 50,${waveY + 2} T 100,${waveY + 2} L 100,100 L 0,100 Z;
                      M 0,${waveY - 2} Q 25,${waveY + 3} 50,${waveY - 2} T 100,${waveY - 2} L 100,100 L 0,100 Z;
                      M 0,${waveY + 2} Q 25,${waveY - 4} 50,${waveY + 2} T 100,${waveY + 2} L 100,100 L 0,100 Z
                    `}
                  />
                )}
              </path>

              {/* Front Wave (Primary fluid surface) */}
              <path
                d={`M 0,${waveY} Q 25,${waveY + 4} 50,${waveY} T 100,${waveY} L 100,100 L 0,100 Z`}
                fill={`url(#liquidFront_${palette.primary.replace("#", "")})`}
                className="transition-all duration-1000 ease-out"
              >
                {isRunning && (
                  <animate
                    attributeName="d"
                    dur="4.4s"
                    repeatCount="indefinite"
                    values={`
                      M 0,${waveY} Q 25,${waveY + 4} 50,${waveY} T 100,${waveY} L 100,100 L 0,100 Z;
                      M 0,${waveY + 3} Q 25,${waveY - 3} 50,${waveY + 3} T 100,${waveY + 3} L 100,100 L 0,100 Z;
                      M 0,${waveY} Q 25,${waveY + 4} 50,${waveY} T 100,${waveY} L 100,100 L 0,100 Z
                    `}
                  />
                )}
              </path>

              {/* Floating Translucent Micro-Bubbles */}
              {isRunning && (
                <>
                  <circle cx="26" cy={Math.min(92, waveY + 14)} r="2" fill="rgba(255,255,255,0.75)">
                    <animate attributeName="cy" dur="3.4s" repeatCount="indefinite" values={`${waveY + 26};${waveY + 2}`} />
                    <animate attributeName="opacity" dur="3.4s" repeatCount="indefinite" values="0.1;0.85;0" />
                  </circle>
                  <circle cx="48" cy={Math.min(92, waveY + 20)} r="2.6" fill="rgba(255,255,255,0.7)">
                    <animate attributeName="cy" dur="4.2s" repeatCount="indefinite" values={`${waveY + 32};${waveY + 1}`} />
                    <animate attributeName="opacity" dur="4.2s" repeatCount="indefinite" values="0.2;0.9;0" />
                  </circle>
                  <circle cx="72" cy={Math.min(92, waveY + 16)} r="1.8" fill="rgba(255,255,255,0.75)">
                    <animate attributeName="cy" dur="3.8s" repeatCount="indefinite" values={`${waveY + 24};${waveY + 3}`} />
                    <animate attributeName="opacity" dur="3.8s" repeatCount="indefinite" values="0.15;0.8;0" />
                  </circle>
                  <circle cx="38" cy={Math.min(92, waveY + 24)} r="1.5" fill="rgba(255,255,255,0.65)">
                    <animate attributeName="cy" dur="2.9s" repeatCount="indefinite" values={`${waveY + 28};${waveY + 4}`} />
                    <animate attributeName="opacity" dur="2.9s" repeatCount="indefinite" values="0.1;0.75;0" />
                  </circle>
                </>
              )}
            </g>
          </svg>
        </div>

        {/* 4. Top Glass Crescent Specular Highlight */}
        <div
          className="absolute top-2 left-6 right-6 h-12 rounded-t-full pointer-events-none opacity-40"
          style={{
            background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0))",
          }}
        />

        {/* 5. Glowing Circular Progress Arc on Rim */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1 sm:p-1.5"
          viewBox="0 0 100 100"
        >
          {/* Subtle Base Track */}
          <circle
            cx="50"
            cy="50"
            r="46"
            stroke="currentColor"
            className="text-slate-200/50"
            strokeWidth="3"
            fill="transparent"
          />
          {/* Glowing Animated Active Arc */}
          <circle
            cx="50"
            cy="50"
            r="46"
            stroke={palette.primary}
            strokeWidth="3.8"
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: "stroke-dashoffset 0.8s ease-out, stroke 0.5s ease",
              filter: `drop-shadow(0 0 7px ${palette.primary})`,
            }}
          />
        </svg>

        {/* 6. Center Content (Icon, Mode Title, Time, Cycle Pill) */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-1 sm:space-y-1.5 pointer-events-none">
          {/* Sprout / Mode Icon */}
          <div className="w-8 h-8 rounded-full bg-white/90 shadow-xs backdrop-blur-xs flex items-center justify-center border border-slate-100">
            {modeInfo.icon}
          </div>

          {/* Mode Title */}
          <span className="text-xs sm:text-sm font-bold tracking-wide text-slate-800">
            {modeInfo.label}
          </span>

          {/* Big Bold Countdown Display */}
          <div
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight tabular-nums text-slate-900 transition-transform duration-300"
            style={{
              textShadow: "0 2px 10px rgba(255,255,255,0.9)",
            }}
          >
            {timeDisplay}
          </div>

          {/* Cycle Pill Badge */}
          <div
            className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border shadow-2xs backdrop-blur-md"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              borderColor: `color-mix(in srgb, ${palette.primary} 30%, #cbd5e1)`,
              color: palette.primaryDark || palette.primary,
            }}
          >
            <span>Cycle {currentCycleDisplay} of {totalCycles}</span>
          </div>

          {/* Paused State */}
          {isPaused && (
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 animate-pulse">
              PAUSED
            </span>
          )}

          {/* Completed State */}
          {isCompleted && (
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3 text-emerald-600" /> Finished!
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiquidTimer;