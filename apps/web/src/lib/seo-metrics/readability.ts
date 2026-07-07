import readability from "text-readability";

export interface ReadabilityResult {
  score: number;
  label: string;
}

function scoreToLabel(score: number): string {
  if (score >= 90) return "Very easy";
  if (score >= 80) return "Easy";
  if (score >= 70) return "Fairly easy";
  if (score >= 60) return "Standard";
  if (score >= 50) return "Fairly difficult";
  if (score >= 30) return "Difficult";
  return "Very difficult";
}

export function scoreReadability(text: string): ReadabilityResult {
  const trimmed = text.trim();

  if (!trimmed) {
    return { score: 0, label: "No content" };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 10) {
    return { score: 0, label: "Too short" };
  }

  try {
    const raw = readability.fleschReadingEase(trimmed);
    const score = Number.isFinite(raw) ? Math.round(raw) : 0;
    const clamped = Math.max(0, Math.min(100, score));
    return { score: clamped, label: scoreToLabel(clamped) };
  } catch {
    return { score: 0, label: "Unable to score" };
  }
}
