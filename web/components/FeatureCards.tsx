import React from "react";

interface FeatureCardsProps {
  stageComplete: { digest: boolean; visualization: boolean; skill: boolean };
}

/**
 * Aurora feature trio — replaces BOTH the portrait pill strip and the
 * landscape card grid in App.tsx. Includes its own flip-to-check icon
 * (same behavior as the old StageCompleteIcon, which can then be
 * removed from App.tsx if unused elsewhere).
 */

interface FlipIconProps {
  complete: boolean;
  bg: string; // e.g. "rgba(139,92,246,0.15)"
  color: string; // e.g. "#a78bfa"
  icon: React.ReactNode;
}

const FlipIcon: React.FC<FlipIconProps> = ({ complete, bg, color, icon }) => (
  <div style={{ perspective: "600px", width: 40, height: 40, flexShrink: 0 }}>
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        transition: "transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: complete ? "rotateY(180deg)" : "rotateY(0deg)",
      }}
    >
      <div
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          background: bg,
          color,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          background: bg,
          color,
          transform: "rotateY(180deg)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
    </div>
  </div>
);

const CARDS = [
  {
    key: "digest" as const,
    title: "Code Digest",
    desc: "The whole repo as one clean, AI-ready text file. Paste it into any model, any context window.",
    color: "#a78bfa",
    titleColor: "#c4b5fd",
    bg: "rgba(139,92,246,0.15)",
    topBorder: "rgba(139,92,246,0.5)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    key: "visualization" as const,
    title: "Code Map",
    desc: "A zoomable, interactive diagram of the architecture. See how every module connects before you touch it.",
    color: "#34d399",
    titleColor: "#6ee7b7",
    bg: "rgba(16,185,129,0.15)",
    topBorder: "rgba(52,211,153,0.5)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="5" r="2.2" />
        <circle cx="5" cy="18" r="2.2" />
        <circle cx="19" cy="18" r="2.2" />
        <path d="M12 7.2v4.3M10.7 13.5 6.3 16.2M13.3 13.5l4.4 2.7" />
      </svg>
    ),
  },
  {
    key: "skill" as const,
    title: "Agent Skill",
    desc: "A packaged SKILL.md with manifest and references. Drop it into Claude, Codex, or any agent framework.",
    color: "#fbbf24",
    titleColor: "#fcd34d",
    bg: "rgba(245,158,11,0.15)",
    topBorder: "rgba(251,191,36,0.5)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
      </svg>
    ),
  },
];

export const FeatureCards: React.FC<FeatureCardsProps> = ({ stageComplete }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto px-6 pt-10 pb-4">
    {CARDS.map((c) => (
      <div
        key={c.key}
        className="rounded-2xl p-6 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1"
        style={{
          background: "rgba(15,23,42,0.8)",
          border: "1px solid rgba(71,85,105,0.5)",
          borderTop: `1px solid ${c.topBorder}`,
        }}
      >
        <FlipIcon
          complete={stageComplete[c.key]}
          bg={c.bg}
          color={c.color}
          icon={c.icon}
        />
        <div className="text-base font-bold" style={{ color: c.titleColor }}>
          {c.title}
        </div>
        <div className="text-[13.5px] leading-relaxed text-slate-400">
          {c.desc}
        </div>
      </div>
    ))}
  </div>
);
