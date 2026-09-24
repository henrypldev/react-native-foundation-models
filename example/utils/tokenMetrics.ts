import type { LanguageModelSession, TokenUsage } from 'react-native-foundation-models'

export type TokenMetrics =
  | { source: 'usage'; last: TokenUsage; sessionTotal?: number }
  | { source: 'counted' | 'estimated'; promptTokens: number; responseTokens: number }

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
  const last = session.lastResponseUsage
  if (last) {
    return { source: 'usage', last, sessionTotal: session.usage?.totalTokens }
  }

  try {
    const [promptTokens, responseTokens] = await Promise.all([
      session.tokenCount(prompt),
      session.tokenCount(response),
    ])
    return { source: 'counted', promptTokens, responseTokens }
  } catch {
    return {
      source: 'estimated',
      promptTokens: estimateTokenCount(prompt),
      responseTokens: estimateTokenCount(response),
    }
  }
}
