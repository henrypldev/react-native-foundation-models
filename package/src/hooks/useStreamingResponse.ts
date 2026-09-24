import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppleAIError } from '../errors'
import { isAppleAIError, parseNativeError } from '../errors'
import type { LanguageModelSession } from '../LanguageModelSession'
import type { GenerationOptions } from '../types'

export interface StreamingOptions extends GenerationOptions {
  onToken?: (token: string) => void
  onComplete?: (fullResponse: string) => void
  onError?: (error: AppleAIError) => void
}

export interface UseStreamingResponseReturn {
  response: string
  isStreaming: boolean
  isComplete: boolean
  error: AppleAIError | null
  streamResponse: (prompt: string, options?: StreamingOptions) => Promise<string>
  cancel: () => void
  reset: () => void
}

export function useStreamingResponse(
  session: LanguageModelSession,
): UseStreamingResponseReturn {
  const [response, setResponse] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [isComplete, setIsComplete] = useState<boolean>(false)
  const [error, setError] = useState<AppleAIError | null>(null)

  const activeStreamRef = useRef<Promise<string> | null>(null)
  const isCancelledRef = useRef<boolean>(false)

  const cancel = useCallback(() => {
    isCancelledRef.current = true
    setIsStreaming(false)
    setIsComplete(false)
  }, [])

  const reset = useCallback(() => {
    setResponse('')
    setIsStreaming(false)
    setIsComplete(false)
    setError(null)
    isCancelledRef.current = false
    activeStreamRef.current = null
  }, [])

  const streamResponse = useCallback(
    async (prompt: string, options?: StreamingOptions): Promise<string> => {
      const { onToken, onComplete, onError, ...generationOptions } = options ?? {}

      if (!session?.session) {
        const error = parseNativeError(new Error('Session not initialized'))
        setError(error)
        onError?.(error)
        throw error
      }

      if (isStreaming) {
        const error = parseNativeError(new Error('Another stream is already in progress'))
        setError(error)
        onError?.(error)
        throw error
      }

      try {
        setIsStreaming(true)
        setIsComplete(false)
        setError(null)
        setResponse('')
        isCancelledRef.current = false

        const streamPromise = session.streamResponse(
          prompt,
          (streamedResponse: string) => {
            if (isCancelledRef.current) return

            setResponse(streamedResponse)
            onToken?.(streamedResponse)
          },
          generationOptions,
        )

        activeStreamRef.current = streamPromise

        const fullResponse = await streamPromise

        if (!isCancelledRef.current) {
          setIsComplete(true)
          setIsStreaming(false)
          onComplete?.(fullResponse)
        }

        return fullResponse
      } catch (err) {
        setIsStreaming(false)
        setIsComplete(false)

        const appleAIError = isAppleAIError(err) ? err : parseNativeError(err)

        if (!isCancelledRef.current) {
          setError(appleAIError)
          onError?.(appleAIError)
        }

        throw appleAIError
      }
    },
    [session, isStreaming],
  )

  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])

  return {
    response,
    isStreaming,
    isComplete,
    error,
    streamResponse,
    cancel,
    reset,
  }
}
