import type { LanguageModelSession } from 'react-native-foundation-models'

export interface TokenMetrics {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimated: boolean
  cachedInputTokens?: number
  reasoningTokens?: number
  sessionTokens?: number
}

/**
 * Fallback approximation used on iOS < 26.4 where the native token counter
 * is not available.
 */
export function estimateTokenCount(text: string): number {
  const normalized = text.trim()

  if (!normalized) {
    return 0
  }

  return Math.ceil(normalized.length / 4)
}

export async function getTokenMetrics(
  session: LanguageModelSession,
  prompt: string,
  response: string,
): Promise<TokenMetrics> {
  const usage = session.lastResponseUsage
  if (usage) {
    return {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimated: false,
      cachedInputTokens: usage.cachedInputTokens,
      reasoningTokens: usage.reasoningTokens,
      sessionTokens: session.usage?.totalTokens,
    }
  }

  try {
    const [inputTokens, outputTokens] = await Promise.all([
      session.tokenCount(prompt),
      session.tokenCount(response),
    ])

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimated: false,
    }
  } catch {
    const inputTokens = estimateTokenCount(prompt)
    const outputTokens = estimateTokenCount(response)

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimated: true,
    }
  }
}
