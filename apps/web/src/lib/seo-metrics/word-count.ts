export interface WordCountResult {
  current: number;
  target?: number;
  percentOfTarget?: number;
}

export function calculateWordCount(
  text: string,
  target?: number
): WordCountResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      current: 0,
      ...(target !== undefined ? { target, percentOfTarget: 0 } : {}),
    };
  }

  const current = trimmed.split(/\s+/).filter(Boolean).length;
  const result: WordCountResult = { current };

  if (target !== undefined && target > 0) {
    result.target = target;
    result.percentOfTarget = Math.round((current / target) * 100);
  }

  return result;
}
