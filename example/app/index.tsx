import { useCallback, useState } from 'react'
import { StyleSheet, Switch } from 'react-native'
import {
  createTool,
  type GenerationOptions,
  getFoundationModelsContextSize,
  LanguageModelSession,
} from 'react-native-foundation-models'
import { z } from 'zod'
import { Text, useThemeColor, View } from '@/components/Themed'
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
const session = new LanguageModelSession({
  instructions: 'You are a helpful assistant',
  tools: [weatherTool],
})
const contextSize = getFoundationModelsContextSize()

export default function IndexScreen() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics>()
  const [contextReset, setContextReset] = useState(false)
  const [greedy, setGreedy] = useState(false)
  const [capTokens, setCapTokens] = useState(false)
  const mutedColor = useThemeColor({}, 'muted')
  const borderColor = useThemeColor({}, 'border')
  const cardColor = useThemeColor({}, 'card')

  const handleSubmit = useCallback(
    async (prompt: string) => {
      setLoading(true)
      setResult('')
      setTokenMetrics(undefined)
      setContextReset(false)

      const generationOptions: GenerationOptions = {
        samplingMode: greedy ? { kind: 'greedy' } : undefined,
        maximumResponseTokens: capTokens ? 30 : undefined,
      }

      try {
        const fullResponse = await session.respond(prompt, generationOptions)
        setResult(fullResponse)
        setTokenMetrics(await getTokenMetrics(session, prompt, fullResponse))
        setContextReset(session.wasContextReset)
      } catch (error) {
        console.error('Failed to get response:', error)
        setResult('Error: Failed to get response')
        setTokenMetrics(undefined)
        setContextReset(session.wasContextReset)
      } finally {
        setLoading(false)
      }
    },
    [greedy, capTokens],
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
    >
      <View style={[styles.card, { borderColor, backgroundColor: cardColor }]}>
        <Text style={[styles.cardLabel, { color: mutedColor }]}>GENERATION OPTIONS</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Greedy sampling</Text>
          <Switch
            testID="generation-greedy-toggle"
            accessibilityLabel="Greedy sampling"
            value={greedy}
            onValueChange={setGreedy}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Cap at 30 tokens</Text>
          <Switch
            testID="generation-max-tokens-toggle"
            accessibilityLabel="Cap at 30 tokens"
            value={capTokens}
            onValueChange={setCapTokens}
          />
        </View>
      </View>
    </WeatherDemo>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  rowLabel: {
    fontSize: 15,
  },
})
