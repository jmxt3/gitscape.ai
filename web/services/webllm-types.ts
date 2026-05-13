/**
 * Shared constants and types for the WebLLM skill generation service.
 *
 * IMPORTANT: This file has ZERO heavy dependencies.
 * It exists so that App.tsx and SkillExport.tsx can import section
 * constants/types without pulling the 6 MB @mlc-ai/web-llm bundle into
 * the main JS chunk. Only the dynamic `import("./webllm")` path in
 * SkillExport.tsx loads the full runtime.
 */

export type ProgressReport = {
  progress: number; // 0–1
  text: string;
};

/**
 * The sections we generate one at a time via WebLLM.
 * Order matters — each section streams and updates the preview live.
 */
export type SkillSection =
  | "description"
  | "overview"
  | "capabilities"
  | "structure"
  | "usage"
  | "boundaries";

export const SKILL_SECTIONS: SkillSection[] = [
  "description",
  "overview",
  "capabilities",
  "structure",
  // usage and boundaries are kept as backend template — no LLM call needed
];

export const SKILL_SECTION_LABELS: Record<SkillSection, string> = {
  description: "Description",
  overview: "Overview",
  capabilities: "Capabilities",
  structure: "Architecture & Structure",
  usage: "Usage Instructions",
  boundaries: "Boundaries",
};

/** 
 * Returns true if WebGPU is available and a compatible adapter is found.
 * Pure check — no imports.
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch (e) {
    return false;
  }
}

/**
 * Synchronous check for WebGPU support.
 */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}
