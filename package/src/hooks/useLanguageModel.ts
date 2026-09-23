import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppleAIError } from '../errors'
import { isAppleAIError, parseNativeError, SessionNotInitializedError } from '../errors'
import {
  LanguageModelSession,
  type LanguageModelSessionOptions,
} from '../LanguageModelSession'
import type { GenerationOptions } from '../types'

export type UseLanguageModelConfig = LanguageModelSessionOptions & {
  onResponse?: (response: string) => void
  onError?: (error: AppleAIError) => void
}

export interface UseLanguageModelReturn {
  session: LanguageModelSession | null
  response: string
  loading: boolean
  error: AppleAIError | null
  send: (prompt: string, options?: GenerationOptions) => Promise<string>
  reset: () => void
  isSessionReady: boolean
}

/**
 * React hook for managing LanguageModelSession lifecycle and interactions.
 * Provides a clean interface for AI conversations with automatic session management.
 *
 * @param config - Configuration object for the language model session
 * @param config.instructions - Optional system instructions to guide the AI's behavior
 * @param config.tools - Optional array of tools that the AI can use during conversations
 * @param config.onResponse - Optional callback fired when a response is received
 * @param config.onError - Optional callback fired when an error occurs
 *
 * @example
 * ```typescript
 * const {
 *   session,
 *   response,
 *   loading,
 *   error,
 *   send,
 *   reset,
 *   isSessionReady
 * } = useLanguageModel({
 *   instructions: 'You are a helpful assistant',
 *   tools: [weatherTool],
 *   onResponse: (response) => console.log('Got response:', response),
 *   onError: (error) => console.error('Error:', error)
 * })
 *
 * const handleSend = async () => {
 *   try {
 *     await send('What is the weather like?')
 *   } catch (error) {
 *     console.error('Failed to send:', error)
 *   }
 * }
 * ```
 */
export function useLanguageModel(
  config?: UseLanguageModelConfig,
): UseLanguageModelReturn {
  const [session, setSession] = useState<LanguageModelSession | null>(null)
  const [response, setResponse] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<AppleAIError | null>(null)
  const [sessionError, setSessionError] = useState<AppleAIError | null>(null)

  const activeStreamRef = useRef<Promise<string> | null>(null)
  const isCancelledRef = useRef<boolean>(false)

  // Store callback refs to avoid dependency issues
  const onErrorRef = useRef(config?.onError)
  const onResponseRef = useRef(config?.onResponse)

  // Update refs when callbacks change
  useEffect(() => {
    onErrorRef.current = config?.onError
    onResponseRef.current = config?.onResponse
  })

  const sessionConfig = useMemo(
    () =>
      ({
        instructions: config?.instructions,
        transcript: config?.transcript,
        tools: config?.tools,
        useCase: config?.useCase,
        guardrails: config?.guardrails,
      }) as LanguageModelSessionOptions,
    [
      config?.instructions,
      config?.transcript,
      config?.tools,
      config?.useCase,
      config?.guardrails,
    ],
  )

  // Initialize session when config changes
  useEffect(() => {
    try {
      setSessionError(null)
      const newSession = new LanguageModelSession(sessionConfig)
      setSession(newSession)
    } catch (err) {
      const appleAIError = isAppleAIError(err) ? err : parseNativeError(err)
      setSessionError(appleAIError)
      setSession(null)
      onErrorRef.current?.(appleAIError)
    }
  }, [sessionConfig])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true
      activeStreamRef.current = null
    }
  }, [])

  const send = useCallback(
    async (prompt: string, options?: GenerationOptions): Promise<string> => {
      if (!session?.session) {
        const error = sessionError || new SessionNotInitializedError()
        setError(error)
        onErrorRef.current?.(error)
        throw error
      }

      if (loading) {
        const error = parseNativeError(
          new Error('Another request is already in progress'),
        )
        setError(error)
        onErrorRef.current?.(error)
        throw error
      }

      try {
        setLoading(true)
        setError(null)
        setResponse('')
        isCancelledRef.current = false

        const responsePromise = session.respond(prompt, options)
        activeStreamRef.current = responsePromise
        const fullResponse = await responsePromise

        if (!isCancelledRef.current) {
          setResponse(fullResponse)
          onResponseRef.current?.(fullResponse)
          setLoading(false)
        }

        return fullResponse
      } catch (err) {
        setLoading(false)
        const appleAIError = isAppleAIError(err) ? err : parseNativeError(err)

        if (!isCancelledRef.current) {
          setError(appleAIError)
          onErrorRef.current?.(appleAIError)
        }

        throw appleAIError
      }
    },
    [session, loading, sessionError],
  )

  const reset = useCallback(() => {
    setResponse('')
    setLoading(false)
    setError(null)
    isCancelledRef.current = true
    activeStreamRef.current = null
  }, [])

  const isSessionReady = Boolean(session?.session && !sessionError)

  return {
    session,
    response,
    loading,
    error: error || sessionError,
    send,
    reset,
    isSessionReady,
  }
}
