import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Header } from "./components/Header";
import { RepoInput } from "./components/RepoInput";
import { GithubTokenModal } from "./components/GithubTokenModal";
import { GithubService, GithubFile } from "./services/githubService";
import { OutputTabs } from "./components/OutputTabs";
import { transformGithubTreeToD3Hierarchy } from "./components/diagramUtils";
import { DiagramFullscreenModal } from "./components/DiagramFullscreenModal";
import { Hero } from "./components/Hero";
import { HowItWorks, Security, OpenSource, FaqSection } from "./components/LandingSections";
import { DevTools } from "./components/DevToolsSection";
import {
  GITHUB_TOKEN_LOCAL_STORAGE_KEY,
  REPO_URL_LOCAL_STORAGE_KEY,
} from "./constants";
import { RawDiagramNode, CachedRepoOutput, SkillManifest, ScanReport, SkillReferences } from "./types";
import { getCachedRepo, setCachedRepo, deleteCachedRepo, sweepStaleEntries } from "./services/repoCache";

// Helper to safely get items from localStorage
const getFromLocalStorage = (key: string, defaultValue: string): string => {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (e) {
    console.warn(`Failed to read '${key}' from localStorage:`, e);
    return defaultValue;
  }
};




// Helper to safely set or remove small string values in localStorage
// (GitHub token, last repo URL). Large repo outputs go to IndexedDB via repoCache.ts.
const storeInLocalStorage = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Failed to write '${key}' to localStorage:`, e);
  }
};

// ─── FuseParticles ────────────────────────────────────────────────────────────
// Canvas particle emitter simulating a real burning match/fuse tip.
// Two layers: large glowing embers + fine wire sparks with motion trails.
interface FuseParticlesProps {
  progressPercent: number;
  step: 1 | 2 | 3;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  hue: number;
  type: "ember" | "spark";
}

// Hue ranges per step: violet | green | amber
const STEP_EMBER_HUE: Record<1 | 2 | 3, [number, number]> = {
  1: [240, 55],  // violet → lavender
  2: [130, 35],  // emerald → lime
  3: [30, 30],  // amber → yellow
};
const STEP_SPARK_HUE: Record<1 | 2 | 3, [number, number]> = {
  1: [270, 40],  // violet-white
  2: [140, 30],  // green-white
  3: [40, 20],  // amber-white
};

const FuseParticles: React.FC<FuseParticlesProps> = ({ progressPercent, step }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const prevPercentRef = useRef<number>(progressPercent);
  // Always reflects latest values without restarting the animation loop
  const stepRef = useRef<1 | 2 | 3>(step);
  const progressPercentRef = useRef<number>(progressPercent);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { progressPercentRef.current = progressPercent; }, [progressPercent]);

  const CANVAS_W = 120;
  const CANVAS_H = 80;
  const OX = CANVAS_W / 2;
  const OY = CANVAS_H / 2;

  const spawn = (isMoving: boolean) => {
    const [eBase, eRange] = STEP_EMBER_HUE[stepRef.current];
    const [sBase, sRange] = STEP_SPARK_HUE[stepRef.current];

    const emberCount = isMoving ? 6 : 2;
    for (let i = 0; i < emberCount; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
      const speed = isMoving ? 0.5 + Math.random() * 1.4 : 0.2 + Math.random() * 0.6;
      particlesRef.current.push({
        x: OX + (Math.random() - 0.5) * 4,
        y: OY + (Math.random() - 0.5) * 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: isMoving ? 0.04 + Math.random() * 0.06 : 0.06 + Math.random() * 0.08,
        size: isMoving ? 0.8 + Math.random() * 1.4 : 0.4 + Math.random() * 0.8,
        hue: eBase + Math.random() * eRange,
        type: "ember",
      });
    }

    const sparkCount = isMoving ? 4 : 1;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 2;
      const speed = isMoving ? 1.4 + Math.random() * 2.8 : 0.6 + Math.random() * 1.2;
      particlesRef.current.push({
        x: OX + (Math.random() - 0.5) * 3,
        y: OY + (Math.random() - 0.5) * 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        life: 1,
        decay: isMoving ? 0.07 + Math.random() * 0.09 : 0.10 + Math.random() * 0.12,
        size: 0.4 + Math.random() * 0.7,
        hue: sBase + Math.random() * sRange,
        type: "spark",
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;

      const currentPercent = progressPercentRef.current;
      // With 50 ms micro-steps the per-frame delta is far too small to
      // reliably exceed a fixed threshold. Instead: the flame is "active"
      // whenever the bar is in motion (0 < progress < 100).
      const isMoving = currentPercent > 0 && currentPercent < 100;
      prevPercentRef.current = currentPercent;

      spawn(isMoving);

      // ── Motion trail: fade existing pixels toward transparent (no black fill) ──
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalCompositeOperation = "source-over";

      // ── Update physics ────────────────────────────────────────────────────
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.type === "ember" ? 0.10 : 0.04) * dt;
        if (p.type === "ember") { p.vx *= 0.97; p.vy *= 0.97; }
        p.life -= p.decay * dt;
      }

      // ── Outer ambient glow (step-aware color) ────────────────────────────
      const [eBase] = STEP_EMBER_HUE[stepRef.current];
      const glowHue = eBase + 15; // slightly shifted for glow warmth
      const outerGlow = ctx.createRadialGradient(OX, OY, 0, OX, OY, 16);
      outerGlow.addColorStop(0, `hsla(${glowHue}, 85%, 65%, 0.14)`);
      outerGlow.addColorStop(0.5, `hsla(${glowHue}, 80%, 45%, 0.07)`);
      outerGlow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(OX, OY, 16, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // ── Core flame glow (step-aware → white-hot centre) ──────────────────
      const coreGlow = ctx.createRadialGradient(OX, OY, 0, OX, OY, 9);
      coreGlow.addColorStop(0, "rgba(255,255,255,0.95)");                             // white-hot core
      coreGlow.addColorStop(0.15, `hsla(${glowHue + 20}, 95%, 88%, 0.80)`);          // light tint
      coreGlow.addColorStop(0.4, `hsla(${glowHue}, 90%, 60%, 0.60)`);                // step color
      coreGlow.addColorStop(0.75, `hsla(${glowHue - 10}, 85%, 40%, 0.25)`);          // deeper shade
      coreGlow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(OX, OY, 9, 0, Math.PI * 2);
      ctx.fillStyle = coreGlow;
      ctx.fill();

      // ── White-hot centre dot ──────────────────────────────────────────────
      ctx.beginPath();
      ctx.arc(OX, OY, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fill();

      // ── Draw embers ───────────────────────────────────────────────────────
      for (const p of particlesRef.current) {
        if (p.type !== "ember") continue;
        const alpha = Math.max(0, p.life);
        const eg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.2);
        eg.addColorStop(0, `hsla(${p.hue}, 90%, 78%, ${alpha * 0.9})`);
        eg.addColorStop(0.5, `hsla(${p.hue}, 85%, 58%, ${alpha * 0.45})`);
        eg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = eg;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 72%, ${alpha})`;
        ctx.fill();
      }

      // ── Draw wire sparks as streaks ───────────────────────────────────────
      ctx.lineWidth = 1.0;
      for (const p of particlesRef.current) {
        if (p.type !== "spark") continue;
        const alpha = Math.max(0, p.life);
        const tailLen = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 2.2;
        const nx = p.vx / (tailLen / 2.2 || 1);
        const ny = p.vy / (tailLen / 2.2 || 1);
        ctx.beginPath();
        ctx.moveTo(p.x - nx * tailLen, p.y - ny * tailLen);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = `hsla(${p.hue}, 80%, 88%, ${alpha * 0.85})`;
        ctx.shadowBlur = 3;
        ctx.shadowColor = `hsl(${p.hue}, 80%, 75%)`;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
    // progressPercent is intentionally read via progressPercentRef so the
    // loop starts once and runs continuously without restarting every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        left: `calc(${progressPercent}% - ${CANVAS_W / 2}px)`,
        transition: "left 0.08s linear",
        width: CANVAS_W,
        height: CANVAS_H,
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ display: "block" }}
      />
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── ConfettiBurst ────────────────────────────────────────────────────────────
// Full-screen canvas confetti explosion. Mount to trigger, unmount to clean up.
const CONFETTI_COLORS = [
  // Violet brand palette
  "#7c3aed", "#a78bfa", "#6d28d9", "#c4b5fd", "#ede9fe",
  // Complementary accents
  "#f59e0b", "#fcd34d", "#ffffff", "#f472b6", "#34d399", "#67e8f9",
];

interface ConfettiPiece {
  x: number; y: number;
  vx: number; vy: number;
  angle: number; spin: number;
  w: number; h: number;
  color: string;
  opacity: number;
  wobble: number; wobbleSpeed: number;
}

const ConfettiBurst: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COUNT = 320;
    const pieces: ConfettiPiece[] = [];

    // Launch from slightly above center-top so burst feels central
    const ox = canvas.width / 2;
    const oy = canvas.height * 0.35;

    for (let i = 0; i < COUNT; i++) {
      // Random angle covering full 360°, biased upward for a "pop" feel
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 18;
      pieces.push({
        x: ox + (Math.random() - 0.5) * 40,
        y: oy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed * (0.5 + Math.random() * 0.8),
        vy: Math.sin(angle) * speed - 4, // slight upward kick
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35,
        w: 6 + Math.random() * 10,
        h: 4 + Math.random() * 6,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        opacity: 1,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.1,
      });
    }

    const DURATION = 3600; // ms
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of pieces) {
        // Physics
        p.wobble += p.wobbleSpeed;
        p.vx += Math.sin(p.wobble) * 0.15; // side-to-side drift
        p.vy += 0.4;                        // gravity
        p.vx *= 0.99;                       // air drag
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        // Fade out in the last 40% of the animation
        p.opacity = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;

        // Draw as a spinning rectangle
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── Processing messages per step ────────────────────────────────────────────
const DIGEST_MESSAGES = [
  "Teaching the AI to read… again.",
  "Snooping through someone else's codebase. Totally normal.",
  "Unpacking files like it's Christmas morning.",
  "The AI is fine. Everything is fine.",
  "Parsing indentation crimes so you don't have to.",
  "Traversing your file tree like a lost tourist.",
  "The robots are reading. Please hold.",
  "This is the part where the progress bar lies to you.",
  "Reading files faster than you can say 'merge conflict'.",
  "One does not simply digest a monorepo.",
  "Your internet is fast. The API is… not.",
  "Predicting what your code does better than you can.",
  "Analyzing dependencies, exports, and vibes.",
];

const VISUALIZATION_MESSAGES = [
  "Mapping every branch, literally.",
  "Drawing the map so your AI never gets lost.",
  "Measuring the architecture. Ruler in hand.",
  "Making your spaghetti code look like modern art.",
  "Fitting all the pieces into a pretty picture.",
  "Connecting the dots between every module.",
  "Turning folder chaos into structured beauty.",
  "Rendering your repo like a Renaissance painting.",
  "Building a dependency graph that would make GraphQL jealous.",
  "Zooming out to see the full picture.",
];

const SKILL_MESSAGES = [
  "Polishing the skill until it sparkles.",
  "This skill will make your AI dangerously capable.",
  "Your agents are about to get a PhD in this codebase.",
  "Soon your AI will know this repo better than you do.",
  "Orienting your agents. Direction: expert.",
  "Unlocking your repo's hidden intelligence.",
  "Crafting a skill your future agents will thank you for.",
  "Extracting signal from the noise, bottling the magic.",
  "Turning raw code into agent superpowers.",
  "Condensing months of dev work into instant context.",
];

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// Returns current step (1, 2, or 3) based on progress percent
const getProgressStep = (pct: number): 1 | 2 | 3 => {
  if (pct < 34) return 1;
  if (pct < 67) return 2;
  return 3;
};

// Returns the bar gradient for the current step
const getStepGradient = (pct: number): string => {
  const step = getProgressStep(pct);
  if (step === 1) return "linear-gradient(90deg, #3b0764 0%, #6d28d9 40%, #7c3aed 70%, #a78bfa 90%, #ede9fe 98%)";
  if (step === 2) return "linear-gradient(90deg, #064e3b 0%, #059669 40%, #10b981 70%, #6ee7b7 90%, #d1fae5 98%)";
  return "linear-gradient(90deg, #78350f 0%, #d97706 40%, #f59e0b 70%, #fcd34d 90%, #fef3c7 98%)";
};

// Returns the glow shadow for the current step
const getStepGlow = (pct: number): string => {
  const step = getProgressStep(pct);
  if (step === 1) return "0 0 8px 2px rgba(124,58,237,0.6)";
  if (step === 2) return "0 0 8px 2px rgba(16,185,129,0.6)";
  return "0 0 8px 2px rgba(245,158,11,0.6)";
};
// ─────────────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>(() =>
    getFromLocalStorage(REPO_URL_LOCAL_STORAGE_KEY, "")
  );
  const [digest, setDigest] = useState<string>("");
  const [showConfetti, setShowConfetti] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressVisible, setProgressVisible] = useState<boolean>(false);
  const [progressFading, setProgressFading] = useState<boolean>(false);
  const progressTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Typewriter effect: animate displayedProgressMessage character-by-character
  const [displayedProgressMessage, setDisplayedProgressMessage] = useState("");
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    if (!progressMessage) { setDisplayedProgressMessage(""); return; }
    let i = 0;
    setDisplayedProgressMessage("");
    typewriterRef.current = setInterval(() => {
      i++;
      setDisplayedProgressMessage(progressMessage.slice(0, i));
      if (i >= progressMessage.length) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      }
    }, 28);
    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current); };
  }, [progressMessage]);

  // Countdown timer for rate-limit cooldown
  useEffect(() => {
    if (retryAfterSeconds === null || retryAfterSeconds <= 0) return;
    const id = setInterval(() => {
      setRetryAfterSeconds(prev => {
        if (prev === null || prev <= 1) { clearInterval(id); return null; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfterSeconds]);


  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);

  const [processedRepoName, setProcessedRepoName] = useState<
    string | undefined
  >(undefined);
  const [repoNameForFilename, setRepoNameForFilename] = useState<string | null>(
    null
  );
  const [currentDefaultBranch, setCurrentDefaultBranch] = useState<
    string | null
  >(null);
  const [filesToRenderInDiagram, setFilesToRenderInDiagram] = useState<
    GithubFile[]
  >([]);

  // Skill export state
  const [skillMd, setSkillMd] = useState<string>("");
  const [manifestJson, setManifestJson] = useState<SkillManifest | null>(null);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [skillReferences, setSkillReferences] = useState<SkillReferences | null>(null);

  // Framework Skill export state
  const [frameworkSkillMd, setFrameworkSkillMd] = useState<string | null>(null);
  const [frameworkManifest, setFrameworkManifest] = useState<SkillManifest | null>(null);
  const [frameworkScanReport, setFrameworkScanReport] = useState<ScanReport | null>(null);
  const [frameworkReferences, setFrameworkReferences] = useState<SkillReferences | null>(null);

  const [showDiagramFullscreenModal, setShowDiagramFullscreenModal] =
    useState<boolean>(false);
  const [diagramDataForModal, setDiagramDataForModal] =
    useState<RawDiagramNode | null>(null);
  const [repoNameForModal, setRepoNameForModal] = useState<string | undefined>(
    undefined
  );
  const [defaultBranchForModal, setDefaultBranchForModal] = useState<
    string | null
  >(null);


  const currentRepoInfoRef = useRef<{ owner: string; repo: string } | null>(
    null
  );
  const currentDefaultBranchForRequestRef = useRef<string | null>(null);
  // Ref so callbacks always read the latest repoUrl without being in dep arrays
  const repoUrlRef = useRef<string>(repoUrl);
  useEffect(() => { repoUrlRef.current = repoUrl; }, [repoUrl]);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(GITHUB_TOKEN_LOCAL_STORAGE_KEY);
      if (storedToken) {
        setGithubToken(storedToken);
      }
    } catch (e) {
      console.warn("Failed to read GitHub token from localStorage:", e);
    }

    const checkSessionAndLoad = async () => {
      try {
        const sessionActive = sessionStorage.getItem("gitScapeSessionActive");
        if (!sessionActive) {
          // Sweep entries older than 24 h — preserves recent scans across new tabs.
          await sweepStaleEntries();
          sessionStorage.setItem("gitScapeSessionActive", "true");
        }
      } catch (e) {
        console.warn("Failed to handle session caching logic:", e);
      }

      if (repoUrl && !isLoading && !digest && !error) {
        try {
          const cachedData = await getCachedRepo(repoUrl);
          if (!cachedData) return;
          setDigest(cachedData.digest);
          setProcessedRepoName(cachedData.processedRepoName);
          setRepoNameForFilename(cachedData.repoNameForFilename);
          setCurrentDefaultBranch(cachedData.defaultBranch);
          setFilesToRenderInDiagram(cachedData.filesToRenderInDiagram || []);
          if (cachedData.skill_md) setSkillMd(cachedData.skill_md);
          if (cachedData.manifest_json) setManifestJson(cachedData.manifest_json);
          if (cachedData.scan_report) setScanReport(cachedData.scan_report);
          if (cachedData.references) setSkillReferences(cachedData.references);
          if (cachedData.framework_skill_md) setFrameworkSkillMd(cachedData.framework_skill_md);
          if (cachedData.framework_manifest) setFrameworkManifest(cachedData.framework_manifest);
          if (cachedData.framework_scan_report) setFrameworkScanReport(cachedData.framework_scan_report);
          if (cachedData.framework_references) setFrameworkReferences(cachedData.framework_references);
        } catch (e) {
          console.warn(`Failed to restore cached data for ${repoUrl}:`, e);
          deleteCachedRepo(repoUrl);
        }
      }
    };

    checkSessionAndLoad();
  }, []);

  useEffect(() => {
    storeInLocalStorage(REPO_URL_LOCAL_STORAGE_KEY, repoUrl || null);
  }, [repoUrl]);

  const githubService = useMemo(() => {
    return new GithubService(githubToken || undefined);
  }, [githubToken]);

  const handleSaveToken = (newToken: string) => {
    const trimmedToken = newToken.trim();
    if (trimmedToken) {
      storeInLocalStorage(GITHUB_TOKEN_LOCAL_STORAGE_KEY, trimmedToken);
      setGithubToken(trimmedToken);
    } else {
      storeInLocalStorage(GITHUB_TOKEN_LOCAL_STORAGE_KEY, null);
      setGithubToken(null);
    }
    setShowTokenModal(false);
  };

  const handleClearToken = () => {
    storeInLocalStorage(GITHUB_TOKEN_LOCAL_STORAGE_KEY, null);
    setGithubToken(null);
    setShowTokenModal(false);
  };



  const processSuccessfulDigestData = useCallback(
    async (
      markdownDigest: string,
      owner: string,
      repo: string,
      defaultBranchFromFetch: string | null,
      digestFilesCount: number | null,
      newSkillMd?: string,
      newManifestJson?: SkillManifest | null,
      newPrimaryLanguages?: string[],
      newReadme?: string,
      newFileStructure?: string,
      newStructureOverview?: string,
      newScanReport?: ScanReport | null,
      newReferences?: SkillReferences | null,
    ) => {
      // Show digest immediately — don't keep user waiting for the tree fetch.
      setDigest(markdownDigest);
      setCurrentDefaultBranch(defaultBranchFromFetch);
      setProgressMessage("🎉 Your skill digest is ready!");
      if (progressTickerRef.current) clearInterval(progressTickerRef.current);
      setProgressPercent(100);
      setIsLoading(false);
      // Fire confetti on completion!
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3800);
      // Fade out the bar after a brief moment instead of vanishing abruptly
      setTimeout(() => setProgressFading(true), 600);
      setTimeout(() => { setProgressVisible(false); setProgressFading(false); setProgressPercent(0); }, 1300);

      const branchToUse = defaultBranchFromFetch;

      // Fetch the file tree in the background so it never blocks the main thread.
      // We defer with setTimeout so React can paint the digest result first.
      if (branchToUse && githubService) {
        setTimeout(async () => {
          let diagramFiles: GithubFile[] = [];
          let finalAnalyzedCount = digestFilesCount;
          try {
            diagramFiles = await githubService.getRepoFileTree(
              owner,
              repo,
              branchToUse
            );
            setFilesToRenderInDiagram(diagramFiles);
            const blobFiles = diagramFiles.filter((file) => file.type === "blob");
            finalAnalyzedCount = blobFiles.length;
          } catch (diagramErr: any) {
            console.error(
              "Error fetching repository structure for diagram:",
              diagramErr
            );
          }

          // Defer the localStorage write to avoid blocking the main thread.
          // JSON.stringify on a large digest is synchronous and can freeze the UI.
          const repoDataToCache: CachedRepoOutput = {
            digest: markdownDigest,
            processedRepoName: `${owner}/${repo}`,
            repoNameForFilename: repo,
            defaultBranch: branchToUse,
            filesAnalyzedCount: finalAnalyzedCount,
            filesToRenderInDiagram: diagramFiles,
            timestamp: Date.now(),
            skill_md: newSkillMd,
            manifest_json: newManifestJson ?? undefined,
            references: newReferences ?? undefined,
            scan_report: newScanReport ?? undefined,
            primary_languages: newPrimaryLanguages,
            readme: newReadme,
            file_structure: newFileStructure,
            structure_overview: newStructureOverview,
          };
          setCachedRepo(repoUrlRef.current, repoDataToCache);
        }, 0);
      } else {
        // No branch info — still cache what we have.
        const repoDataToCache: CachedRepoOutput = {
          digest: markdownDigest,
          processedRepoName: `${owner}/${repo}`,
          repoNameForFilename: repo,
          defaultBranch: branchToUse,
          filesAnalyzedCount: digestFilesCount,
          filesToRenderInDiagram: [],
          timestamp: Date.now(),
          skill_md: newSkillMd,
          manifest_json: newManifestJson ?? undefined,
          references: newReferences ?? undefined,
          scan_report: newScanReport ?? undefined,
          primary_languages: newPrimaryLanguages,
          readme: newReadme,
          file_structure: newFileStructure,
          structure_overview: newStructureOverview,
        };
        setCachedRepo(repoUrlRef.current, repoDataToCache);
      }
    },
    // Only stable references — state setters and the github service.
    // repoUrl is read via repoUrlRef.current so it doesn't need to be here.
    [
      githubService,
      setDigest,
      setCurrentDefaultBranch,
      setFilesToRenderInDiagram,
      setProgressMessage,
      setIsLoading,
      setProgressPercent,
    ]
  );

  const handleGenerateDigest = useCallback(async () => {
    if (!repoUrl) {
      setError("Please enter a GitHub repository URL.");
      return;
    }

    storeInLocalStorage("gitScapeDigestContent", null);

    setIsLoading(true);
    setError(null);
    setDigest("");
    setProgressMessage("🚀 Igniting the engines...");
    setProgressPercent(0);
    setProgressVisible(true);
    setProgressFading(false);

    // Start the fuse ticker at 50 ms for smooth, continuous movement.
    // Step size is scaled down proportionally (700 / 50 = ×14) so the
    // overall speed to reach 88 % is unchanged but without visible jumps.
    if (progressTickerRef.current) clearInterval(progressTickerRef.current);
    let msgTick = 0;
    progressTickerRef.current = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 88) {
          if (progressTickerRef.current) clearInterval(progressTickerRef.current);
          return prev;
        }
        const remaining = 88 - prev;
        // Same asymptotic approach but in micro-steps every 50 ms
        const stepSize = Math.max(0.02, remaining * 0.003);
        return Math.min(88, prev + stepSize);
      });
      // Rotate joke every ~84 ticks (50 ms × 84 ≈ 4.2 s)
      msgTick++;
      if (msgTick % 84 === 0) {
        setProgressPercent((pct) => {
          const s = getProgressStep(pct);
          const pool = s === 1 ? DIGEST_MESSAGES : s === 2 ? VISUALIZATION_MESSAGES : SKILL_MESSAGES;
          setProgressMessage(pick(pool));
          return pct;
        });
      }
    }, 50);

    setProcessedRepoName(undefined);
    setRepoNameForFilename(null);
    setCurrentDefaultBranch(null);
    setFilesToRenderInDiagram([]);
    setSkillMd("");
    setManifestJson(null);
    setScanReport(null);
    setSkillReferences(null);
    setFrameworkSkillMd(null);
    setFrameworkManifest(null);
    setFrameworkScanReport(null);
    setFrameworkReferences(null);
    currentRepoInfoRef.current = null;
    currentDefaultBranchForRequestRef.current = null;


    if (!githubService) {
      setError("GitHub service is not available. Please refresh.");
      setIsLoading(false);
      setProgressMessage("");
      return;
    }

    const parsedUrl = githubService.parseGitHubUrl(repoUrl);
    if (!parsedUrl) {
      setError(
        "Invalid GitHub URL format. Example: https://github.com/owner/repo"
      );
      setIsLoading(false);
      setProgressMessage("");
      return;
    }

    const { owner, repo } = parsedUrl;
    currentRepoInfoRef.current = { owner, repo };
    const currentRepoName = `${owner}/${repo}`;
    setProcessedRepoName(currentRepoName);
    setRepoNameForFilename(repo);

    let defaultBranchForThisRequest: string | null = null;
    try {
      setProgressMessage("🔍 Scanning the repo...");
      defaultBranchForThisRequest = await githubService.getDefaultBranch(
        owner,
        repo
      );
      currentDefaultBranchForRequestRef.current = defaultBranchForThisRequest;
      setProgressMessage("⚡ Repo locked. Firing up the server...");
    } catch (branchError: any) {
      console.error("Failed to fetch default branch:", branchError);
      if (progressTickerRef.current) clearInterval(progressTickerRef.current);
      const isRateLimit = branchError.message?.includes("403") || branchError.message?.includes("rate limit");
      setError(
        isRateLimit
          ? "GitHub API rate limit reached. Add a GitHub token (top-right) to get 5,000 requests/hour instead of 60."
          : `Failed to fetch repository details: ${branchError.message}. Please ensure the repository is public or add a GitHub token.`
      );
      setIsLoading(false);
      setProgressFading(true);
      setTimeout(() => { setProgressVisible(false); setProgressFading(false); setProgressPercent(0); }, 700);
      return;
    }

    const initiateRequest = async () => {
      setProgressMessage(pick(DIGEST_MESSAGES));
      // Ticker is already running from init — no need to restart it here


      // API calls use a relative /api/* path — nginx proxies to the FastAPI sidecar in
      // production, and the Vite dev server proxies to localhost:8081 in development.
      const apiUrl = new URL("/api/converter", window.location.origin);
      apiUrl.searchParams.append("repo_url", repoUrl);
      if (githubToken) {
        apiUrl.searchParams.append("github_token", githubToken);
      }

      try {
        const response = await fetch(apiUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          let errorDetail = `We couldn't fetch the repository (HTTP ${response.status}).`;
          if (response.status === 429) {
            try {
              const errData = await response.json();
              const secs = errData.retry_after_seconds ?? 60;
              setRetryAfterSeconds(secs);
              errorDetail = `Rate limit reached. You can generate again in ${secs} seconds.`;
            } catch (_) {
              errorDetail = "Rate limit reached. Please wait a moment and try again.";
            }
          } else if (response.status === 503) {
            errorDetail =
              "This repository is too large to process (the server ran out of memory). " +
              "Try a smaller repository or add a GitHub token to enable sparse cloning of private repos.";
          } else {
            try {
              const errorData = await response.json();
              if (errorData.detail) {
                errorDetail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
              } else if (errorData.message) {
                errorDetail = errorData.message;
              }
            } catch (e) { }
          }
          throw new Error(errorDetail);
        }

        const data = await response.json();

        setProgressMessage("✨ Almost there — polishing the digest...");
        setProgressPercent(90);

        const markdownDigest = data.digest;
        if (!markdownDigest || typeof markdownDigest !== 'string') {
          throw new Error("Invalid or empty digest returned by the server.");
        }

        // Store skill fields from the SkillForge /converter response.
        // (Additive: digest + visualization fields above are unaffected.)
        if (data.skill_md) setSkillMd(data.skill_md);
        if (data.manifest) setManifestJson(data.manifest);
        if (data.scan_report) setScanReport(data.scan_report);
        if (data.references) setSkillReferences(data.references);

        const branchForProcessing = data.default_branch || currentDefaultBranchForRequestRef.current;
        const digestFilesCount = data.files_analyzed_count !== undefined ? Number(data.files_analyzed_count) : null;

        if (!currentRepoInfoRef.current) {
          throw new Error("Repository owner/name info missing for final processing.");
        }
        const { owner: currentOwner, repo: currentRepo } = currentRepoInfoRef.current;

        await processSuccessfulDigestData(
          markdownDigest,
          currentOwner,
          currentRepo,
          branchForProcessing,
          digestFilesCount,
          data.skill_md,
          data.manifest,
          data.primary_languages,
          data.readme,
          data.file_structure,
          data.structure_overview,
          data.scan_report,
          data.references,
        );

      } catch (err: any) {
        console.error("Error fetching digest:", err);
        if (progressTickerRef.current) clearInterval(progressTickerRef.current);
        setError(
          err.message ||
          "We couldn't fetch the repository. Please add a GitHub Personal Access Token (PAT) and try again."
        );
        setProgressMessage("Error occurred during request.");
        setIsLoading(false);
        setProgressFading(true);
        setTimeout(() => { setProgressVisible(false); setProgressFading(false); setProgressPercent(0); }, 700);
      }
    };

    initiateRequest();
    // Only truly stable or necessary deps. Volatile state (isLoading, error,
    // digest, progressPercent) is intentionally omitted — they caused the
    // callback to be recreated on every render, triggering render loops.
  }, [
    repoUrl,
    githubToken,
    githubService,
    processSuccessfulDigestData,
  ]);

  const handleFrameworkSkillGenerated = useCallback((
    newSkillMd: string,
    newManifest: SkillManifest | null,
    newScanReport: ScanReport | null,
    newReferences: SkillReferences | null
  ) => {
    setFrameworkSkillMd(newSkillMd);
    setFrameworkManifest(newManifest);
    setFrameworkScanReport(newScanReport);
    setFrameworkReferences(newReferences);

    // Save to IndexedDB cache
    getCachedRepo(repoUrlRef.current).then((cachedData) => {
      if (!cachedData) return;
      const updatedCache: CachedRepoOutput = {
        ...cachedData,
        framework_skill_md: newSkillMd,
        framework_manifest: newManifest ?? undefined,
        framework_scan_report: newScanReport ?? undefined,
        framework_references: newReferences ?? undefined,
        timestamp: Date.now(),
      };
      setCachedRepo(repoUrlRef.current, updatedCache);
    });
  }, []);


  // Defer the expensive tree transform to a separate browser task.
  // Using useEffect + setTimeout means this NEVER runs during a user-click
  // event — it always runs in its own task after the browser is idle.
  const [diagramData, setDiagramData] = useState<RawDiagramNode | null>(null);
  useEffect(() => {
    if (!processedRepoName || filesToRenderInDiagram.length === 0) {
      setDiagramData(null);
      return;
    }
    const id = setTimeout(() => {
      setDiagramData(
        transformGithubTreeToD3Hierarchy(filesToRenderInDiagram, processedRepoName)
      );
    }, 0);
    return () => clearTimeout(id);
  }, [filesToRenderInDiagram, processedRepoName]);

  useEffect(() => {
    if (githubService && digest && !processedRepoName && repoUrl) {
      const parsed = githubService.parseGitHubUrl(repoUrl);
      if (parsed) {
        setProcessedRepoName(`${parsed.owner}/${parsed.repo}`);
        if (!repoNameForFilename) {
          setRepoNameForFilename(parsed.repo);
        }
      }
    }
  }, [digest, processedRepoName, repoUrl, githubService, repoNameForFilename]);

  const handleOpenDiagramFullscreenModal = useCallback(
    (data: RawDiagramNode, repoNameModal: string, branch: string | null) => {
      setDiagramDataForModal(data);
      setRepoNameForModal(repoNameModal);
      setDefaultBranchForModal(branch);
      setShowDiagramFullscreenModal(true);
      document.body.style.overflow = "hidden";
    },
    []
  );

  const handleCloseDiagramFullscreenModal = useCallback(() => {
    setShowDiagramFullscreenModal(false);
    setDiagramDataForModal(null);
    setRepoNameForModal(undefined);
    setDefaultBranchForModal(null);
    document.body.style.overflow = "";
  }, []);

  const showOutputArea =
    repoUrl.trim() !== "" &&
    ((!isLoading &&
      (digest || (diagramData && filesToRenderInDiagram.length > 0)) &&
      !error) ||
    (!isLoading && processedRepoName && digest));

  // Clear all output when the user erases the repo URL
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (repoUrl.trim() !== "") return;
    setDigest("");
    setError(null);
    setProcessedRepoName(undefined);
    setRepoNameForFilename(null);
    setCurrentDefaultBranch(null);
    setFilesToRenderInDiagram([]);
    setSkillMd("");
    setManifestJson(null);
    setScanReport(null);
    setSkillReferences(null);
    setDiagramData(null);
    setRetryAfterSeconds(null);
  }, [repoUrl]);

  return (
    <div className="min-h-screen text-slate-200 flex flex-col">
      {showConfetti && <ConfettiBurst />}
      <Header
        onToggleTokenModal={() => setShowTokenModal(true)}
        hasToken={!!githubToken}
      />
      <main className="flex-grow">
        {/* ── First-screen hero section with shared aurora background ── */}
        <div className="relative overflow-hidden pb-12">
          {/* Aurora blobs */}
          <div className="hero-blob-1" />
          <div className="hero-blob-2" />
          <div className="hero-blob-3" />
          {/* Subtle dot/grid overlay */}
          <div className="grid-pattern" />

          <Hero />
          <div className="relative space-y-12">
            <section id="digest-generator-input" className="relative w-full max-w-[752px] mx-auto px-4">
            <div
              className="rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3"
              style={{
                background: "rgba(15,23,42,0.75)",
                border: "1px solid rgba(139,92,246,0.35)",
                boxShadow: "0 12px 48px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.08)",
              }}
            >
            {progressVisible && (
              <div
                className="w-full mb-1 relative"
                style={{ opacity: progressFading ? 0 : 1, transition: "opacity 0.7s ease-out" }}
                aria-live="polite"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Generation progress"
              >
                {/* Step labels */}
                <div className="flex justify-between mb-2 px-0.5">
                  {[
                    { label: "CODE DIGEST", threshold: 0, activeColor: "text-violet-400", inactiveColor: "text-slate-600" },
                    { label: "CODE MAP", threshold: 34, activeColor: "text-emerald-400", inactiveColor: "text-slate-600" },
                    { label: "AGENT SKILL", threshold: 67, activeColor: "text-amber-400", inactiveColor: "text-slate-600" },
                  ].map((step, i) => {
                    const isActive = progressPercent >= step.threshold;
                    const isCurrent = getProgressStep(progressPercent) === i + 1;
                    return (
                      <div key={step.label} className="flex flex-col items-center gap-1" style={{ width: "33.3%", alignItems: i === 0 ? "flex-start" : i === 2 ? "flex-end" : "center" }}>
                        <span
                          className={`text-[11px] font-bold tracking-[0.05em] transition-all duration-500 ${isActive ? step.activeColor : step.inactiveColor
                            } ${isCurrent ? "opacity-100" : isActive ? "opacity-70" : "opacity-40"}`}
                        >
                          {step.label}
                        </span>
                        <div
                          className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                          style={{
                            background: isActive
                              ? i === 0 ? "#a78bfa" : i === 1 ? "#34d399" : "#fbbf24"
                              : "#334155",
                            boxShadow: isCurrent
                              ? i === 0 ? "0 0 6px 2px rgba(167,139,250,0.8)" : i === 1 ? "0 0 6px 2px rgba(52,211,153,0.8)" : "0 0 6px 2px rgba(251,191,36,0.8)"
                              : "none",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Fuse track */}
                <div
                  className="relative rounded-full"
                  style={{ height: "10px", background: "linear-gradient(90deg, #0d0a1a 0%, #1a1030 50%, #0d0a1a 100%)", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)" }}
                >
                  {/* Filled portion with step-aware color */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${progressPercent}%`,
                      background: getStepGradient(progressPercent),
                      boxShadow: getStepGlow(progressPercent),
                      transition: "width 0.08s linear, background 1s ease, box-shadow 1s ease",
                    }}
                  />
                  {/* Spark tip */}
                  {progressPercent < 100 && (
                    <FuseParticles progressPercent={progressPercent} step={getProgressStep(progressPercent)} />
                  )}
                </div>

                <style>{`
                  @keyframes fuseFlicker {
                    0%   { transform: scale(1);   opacity: 1; }
                    33%  { transform: scale(1.4); opacity: 0.9; }
                    66%  { transform: scale(0.85); opacity: 1; }
                    100% { transform: scale(1.3); opacity: 0.85; }
                  }
                `}</style>
              </div>
            )}
            <RepoInput
              repoUrl={repoUrl}
              setRepoUrl={setRepoUrl}
              onGenerate={handleGenerateDigest}
              isLoading={isLoading}
            />
            {isLoading && progressMessage && (
              <p
                className={`mt-3 text-sm text-center transition-colors duration-700 ${getProgressStep(progressPercent) === 1
                    ? "text-violet-400"
                    : getProgressStep(progressPercent) === 2
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
              >
                {displayedProgressMessage}
                {/* Blinking cursor while message is still typing or loading */}
                <span
                  style={{
                    display: 'inline-block',
                    width: '0.5em',
                    height: '1em',
                    marginLeft: '2px',
                    verticalAlign: 'text-bottom',
                    borderRadius: '1px',
                    animation: 'msgCursorBlink 0.8s steps(1) infinite',
                    background: getProgressStep(progressPercent) === 1
                      ? 'rgba(167,139,250,0.85)'
                      : getProgressStep(progressPercent) === 2
                      ? 'rgba(52,211,153,0.85)'
                      : 'rgba(251,191,36,0.85)',
                  }}
                />
              </p>
            )}
            <style>{`
              @keyframes msgCursorBlink {
                0%, 49% { opacity: 1; }
                50%, 100% { opacity: 0; }
              }
            `}</style>
            {error && !isLoading && (
              retryAfterSeconds !== null ? (
                <div className="mt-3 flex items-center gap-3 text-sm bg-amber-900/20 border border-amber-700/50 p-3 rounded-md">
                  <span className="text-2xl font-bold tabular-nums text-amber-300 min-w-[2.5rem] text-center">{retryAfterSeconds}s</span>
                  <p className="text-amber-300">⏱ Rate limit reached — you can generate again in <span className="font-semibold">{retryAfterSeconds} seconds</span>.</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/50 p-3 rounded-md text-center">
                  <span className="font-semibold">Error:</span> {error}
                </p>
              )
            )}
            </div>

            <p className="mt-3 mb-0 text-center text-[12.5px] text-slate-500">
              Public repos free, no account. Private repos with your token — it never leaves your browser.
            </p>
          </section>

          </div>{/* end relative space-y-12 */}
        </div>{/* end aurora wrapper */}

        {showOutputArea && (
          <section id="output-area" className="max-w-5xl mx-auto px-4 sm:px-6 w-full mt-12">
            <OutputTabs
              digest={digest}
              isLoadingDigest={isLoading && progressPercent < 100 && !digest}
              diagramData={diagramData}
              repoName={processedRepoName!}
              repoNameForFilename={repoNameForFilename}
              defaultBranch={currentDefaultBranch}
              filesCount={filesToRenderInDiagram.filter((f) => f.type === "blob").length || null}
              onOpenDiagramFullscreenModal={handleOpenDiagramFullscreenModal}
              skillMd={skillMd}
              manifestJson={manifestJson}
              scanReport={scanReport}
              references={skillReferences}
              repoUrl={repoUrl}
              githubToken={githubToken}
              frameworkSkillMd={frameworkSkillMd}
              frameworkManifest={frameworkManifest}
              frameworkScanReport={frameworkScanReport}
              frameworkReferences={frameworkReferences}
              onFrameworkSkillGenerated={handleFrameworkSkillGenerated}
            />
          </section>
        )}

        <div className={showOutputArea ? "mt-16 sm:mt-20" : ""}>
          <DevTools />
          <HowItWorks />
          <Security />
          <OpenSource />
          <FaqSection />
        </div>
      </main>

      <footer
        className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 sm:px-10 py-7 text-[13px] text-slate-500"
        style={{ borderTop: "1px solid rgba(71,85,105,0.25)" }}
      >
        <span>
          made with ❤️ by{" "}
          <a
            href="https://www.linkedin.com/in/jmachete/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            João Machete
          </a>
        </span>
        <div className="flex gap-6">
          <a
            href="https://github.com/jmxt3/Git-Scape-Web"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/gitscape"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors"
          >
            CLI on npm
          </a>
          <a
            href="#developer-tools"
            className="hover:text-slate-300 transition-colors"
          >
            MCP server
          </a>
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors"
          >
            API docs
          </a>
          <a
            href="https://github.com/jmxt3/Git-Scape-Web/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors"
          >
            MIT license
          </a>
        </div>
      </footer>

      {showTokenModal && (
        <GithubTokenModal
          isOpen={showTokenModal}
          onClose={() => setShowTokenModal(false)}
          onSaveToken={handleSaveToken}
          onClearToken={handleClearToken}
          currentToken={githubToken || ""}
        />
      )}

      {showDiagramFullscreenModal &&
        diagramDataForModal &&
        repoNameForModal && (
          <DiagramFullscreenModal
            isOpen={showDiagramFullscreenModal}
            onClose={handleCloseDiagramFullscreenModal}
            data={diagramDataForModal}
            repoName={repoNameForModal}
            defaultBranch={defaultBranchForModal || ""}
          />
        )}
    </div>
  );
};

export default App;
