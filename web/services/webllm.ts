/**
 * WebLLM service for client-side AI inference via WebGPU.
 * Uses Qwen2 0.5B — ultra-low cost, no server, no API key required.
 *
 * IMPORTANT: This module uses a dynamic import() for @mlc-ai/web-llm so the
 * ~10 MB SDK is NEVER parsed at startup. It is only fetched when the user
 * explicitly triggers AI generation.
 *
 * Author: João Machete
 */

// Qwen2-0.5B — ~350 MB model, cached in browser Cache API after first download
const MODEL_ID = "Qwen2-0.5B-Instruct-q4f16_1-MLC";

// We use `any` here to avoid pulling in the webllm types at compile time.
// The dynamic import resolves the real types at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let engineInstance: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let engineLoadPromise: Promise<any> | null = null;

export type ProgressReport = {
  progress: number; // 0–1
  text: string;
};

// ─── Section types ────────────────────────────────────────────────────────────

/**
 * The 5 sections we generate one at a time.
 * Order matters — each section streams and updates the preview live.
 */
export type SkillSection =
  | "description"
  | "overview"
  | "capabilities"
  | "usage"
  | "boundaries";

export const SKILL_SECTIONS: SkillSection[] = [
  "description",
  "overview",
  "capabilities",
  "usage",
  "boundaries",
];

export const SKILL_SECTION_LABELS: Record<SkillSection, string> = {
  description: "Description",
  overview:    "Overview",
  capabilities: "Capabilities",
  usage:       "Usage Instructions",
  boundaries:  "Boundaries",
};

/** Returns true if WebGPU is available in this browser. Pure check — no imports. */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * Lazily import @mlc-ai/web-llm and return the module.
 * The dynamic import() is only executed once; subsequent calls reuse the cached module.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _webllmModule: any | null = null;
async function getWebLLMModule() {
  if (!_webllmModule) {
    // Dynamic import — only fetches and parses the bundle on first call
    _webllmModule = await import("@mlc-ai/web-llm");
  }
  return _webllmModule;
}

/**
 * Get (or lazily initialize) the shared MLCEngine instance.
 * Safe to call multiple times — returns the cached engine after first load.
 */
export async function getEngine(
  onProgress?: (report: ProgressReport) => void
): Promise<unknown> {
  if (engineInstance) return engineInstance;

  if (!engineLoadPromise) {
    engineLoadPromise = (async () => {
      const webllm = await getWebLLMModule();
      const engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          onProgress?.({ progress: report.progress, text: report.text });
        },
      });
      engineInstance = engine;
      return engine;
    })().catch((err) => {
      engineLoadPromise = null; // allow retry on failure
      throw err;
    });
  }

  return engineLoadPromise;
}

// ─── Section-specific prompts ─────────────────────────────────────────────────
// Kept deliberately short and direct — Qwen 0.5B follows simple, imperative
// instructions far better than long, elaborated prompts.

function buildPrompt(
  section: SkillSection,
  repoName: string,
  langStr: string,
  currentContent: string   // existing section text to improve
): { prompt: string; max_tokens: number } {
  switch (section) {
    case "description":
      return {
        max_tokens: 160,
        prompt: `Rewrite this AI skill description to be clearer and more specific.
Repository: ${repoName} (${langStr})
Current: ${currentContent.substring(0, 400)}

Rules: 2-3 sentences. Keep factual details. Use "Use when working with" phrasing. No quotes, no markdown.
Output ONLY the rewritten description:`,
      };

    case "overview":
      return {
        max_tokens: 200,
        prompt: `Rewrite this Overview section for the ${repoName} skill.
Current text:
${currentContent.substring(0, 500)}

Rules: 3 sentences of plain prose. First: what the repo does. Second: key components. Third: who uses it. No bullets.
Output ONLY the rewritten paragraph:`,
      };

    case "capabilities":
      return {
        max_tokens: 220,
        prompt: `Rewrite these capabilities for the ${repoName} agent skill.
Current list:
${currentContent.substring(0, 500)}

Rules: Keep 5-6 bullet points starting with "- ". Make each specific to ${repoName}. Improve wording only.
Output ONLY the bullet list:`,
      };

    case "usage":
      return {
        max_tokens: 180,
        prompt: `Rewrite these usage instructions for the ${repoName} skill.
Current:
${currentContent.substring(0, 400)}

Rules: Numbered list 1. 2. 3. Each item under 20 words. Tell the agent exactly what to do. No headers.
Output ONLY the numbered list:`,
      };

    case "boundaries":
      return {
        max_tokens: 160,
        prompt: `Rewrite these boundary rules for the ${repoName} skill.
Current:
${currentContent.substring(0, 400)}

Rules: Numbered list 1. 2. 3. Each says what the agent must NOT do or must acknowledge. Under 20 words each.
Output ONLY the numbered list:`,
      };
  }
}

// ─── Core streaming helper ────────────────────────────────────────────────────

async function streamCompletion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engine: any,
  prompt: string,
  max_tokens: number,
  onChunk?: (partial: string) => void
): Promise<string> {
  const stream = await engine.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    max_tokens,
    temperature: 0.35,
    top_p: 0.9,
    stream: true,
  });

  let full = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of stream as AsyncIterable<any>) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      onChunk?.(full);
    }
  }

  return full.trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate one SKILL.md section at a time.
 * The engine is loaded once and reused across all subsequent calls in the
 * same session — model download only happens on the very first invocation.
 */
export async function generateSkillSection(
  section: SkillSection,
  repoName: string,
  languages: string[],
  digestSnippet: string,
  onProgress?: (report: ProgressReport) => void,
  onChunk?: (partial: string) => void
): Promise<string> {
  const engine = await getEngine(onProgress);
  const langStr = languages.join(", ") || "multiple languages";
  const { prompt, max_tokens } = buildPrompt(section, repoName, langStr, digestSnippet);

  return streamCompletion(engine, prompt, max_tokens, onChunk);
}

/**
 * Legacy single-call description generator.
 * Kept for backward compatibility — prefer generateSkillSection("description").
 */
export async function generateSkillDescription(
  repoName: string,
  languages: string[],
  digestSnippet: string,
  onProgress?: (report: ProgressReport) => void,
  onChunk?: (partial: string) => void
): Promise<string> {
  return generateSkillSection("description", repoName, languages, digestSnippet, onProgress, onChunk);
}

/** Dispose the engine to free GPU memory (optional, call on page unload if needed) */
export async function disposeEngine(): Promise<void> {
  if (engineInstance) {
    await engineInstance.unload?.();
    engineInstance = null;
    engineLoadPromise = null;
  }
}
