import { useCallback, useState } from 'react'
import {
  createTool,
  getFoundationModelsContextSize,
  LanguageModelSession,
  parseNativeError,
} from 'react-native-foundation-models'
import { z } from 'zod'
import { WeatherDemo } from '@/components/WeatherDemo'
import { getTokenMetrics, type TokenMetrics } from '@/utils/tokenMetrics'
import { weatherResult } from '@/utils/weatherResult'

const WEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather'
const options = {
  method: 'GET',
  headers: { accept: 'application/json', 'accept-encoding': 'deflate, gzip, br' },
}

const weatherTool = createTool({
  name: 'weather_tool',
  description: 'A weather tool that can get current weather information for any city.',
  arguments: z.object({
    city: z.string().describe('The city to get the weather for'),
    units: z.enum(['celsius', 'fahrenheit']).default('fahrenheit'),
  }),
  handler: async args => {
    try {
      const apiUnits = args.units === 'celsius' ? 'metric' : 'imperial'
      const url = `${BASE_URL}?units=${apiUnits}&q=${args.city}&APPID=${WEATHER_API_KEY}`
      const res = await fetch(url, options)
      const result = await res.json()

      if (!result.main) {
        throw new Error(`Invalid API response structure: ${JSON.stringify(result)}`)
      }

      return weatherResult(result, args.units)
    } catch (error) {
      console.error('Weather tool error:', error)
      return weatherResult(undefined, args.units)
    }
  },
})
const contextSize = getFoundationModelsContextSize()

function createWeatherSession() {
  const session = new LanguageModelSession({
    instructions: 'You are a helpful assistant',
    tools: [weatherTool],
  })
  session.prewarm()
  return session
}

export default function IndexScreen() {
  const [session] = useState(createWeatherSession)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics>()
  const [contextReset, setContextReset] = useState(false)

  const handleSubmit = useCallback(
    async (prompt: string) => {
      setLoading(true)
      setResult('')
      setTokenMetrics(undefined)
      setContextReset(false)

      try {
        const fullResponse = await session.respond(prompt)
        setResult(fullResponse)
        setTokenMetrics(await getTokenMetrics(session, prompt, fullResponse))
      } catch (error) {
        console.error('Failed to get response:', error)
        setResult(`Error: ${parseNativeError(error).code}`)
      } finally {
        setContextReset(session.wasContextReset)
        setLoading(false)
      }
    },
    [session],
  )

  return (
    <WeatherDemo
      title="Foundation Models"
      subtitle="On-device weather tool"
      response={result}
      isLoading={loading}
      onSubmit={handleSubmit}
      metrics={{
        contextSize,
        tokens: tokenMetrics,
        contextReset,
      }}
    />
  )
}
