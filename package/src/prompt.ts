import { AppleAIError } from './errors'
import type { NativePrompt } from './specs/LanguageModelSession.nitro'
import type { PromptInput } from './types'

export function toNativePrompt(input: PromptInput): NativePrompt {
  if (typeof input === 'string') {
    return { text: input, images: [] }
  }
  const images = (input.images ?? []).map(({ uri, label }, index) => {
    if (!uri.startsWith('file://')) {
      const field = `images[${index}].uri`
      throw new AppleAIError(
        'INVALID_PROMPT',
        `Invalid prompt \`${field}\`: only file:// URIs are supported`,
        { field, value: uri },
      )
    }
    return { url: uri, label }
  })
  return { text: input.text, images }
}
