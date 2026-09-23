import { useCallback, useState } from 'react'
import { StyleSheet, Switch, TouchableOpacity } from 'react-native'
import {
  checkFoundationModelsAvailability,
  createTool,
  type GenerationOptions,
  getFoundationModelsContextSize,
  LanguageModelSession,
  parseNativeError,
  type ReasoningLevel,
  type SerializedTranscript,
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
const initialSession = new LanguageModelSession({
  instructions: 'You are a helpful assistant',
  tools: [weatherTool],
})
initialSession.prewarm()
const contextSize = getFoundationModelsContextSize()
const availability = checkFoundationModelsAvailability()
const reasoningChoices: Array<{ label: string; level?: ReasoningLevel }> = [
  { label: 'Off' },
  { label: 'Light', level: 'light' },
  { label: 'Moderate', level: 'moderate' },
  { label: 'Deep', level: 'deep' },
]

export default function IndexScreen() {
  const [session, setSession] = useState(initialSession)
  const [savedTranscript, setSavedTranscript] = useState<SerializedTranscript>()
  const [transcriptStatus, setTranscriptStatus] = useState('No transcript saved')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics>()
  const [contextReset, setContextReset] = useState(false)
  const [greedy, setGreedy] = useState(false)
  const [capTokens, setCapTokens] = useState(false)
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>()
  const mutedColor = useThemeColor({}, 'muted')
  const borderColor = useThemeColor({}, 'border')
  const cardColor = useThemeColor({}, 'card')
  const tintColor = useThemeColor({}, 'tint')

  const handleSubmit = useCallback(
    async (prompt: string) => {
      setLoading(true)
      setResult('')
      setTokenMetrics(undefined)
      setContextReset(false)

      const generationOptions: GenerationOptions = {
        samplingMode: greedy ? { kind: 'greedy' } : undefined,
        maximumResponseTokens: capTokens ? 30 : undefined,
        reasoningLevel,
      }

      try {
        const fullResponse = await session.respond(prompt, generationOptions)
        setResult(fullResponse)
        setTokenMetrics(await getTokenMetrics(session, prompt, fullResponse))
        setContextReset(session.wasContextReset)
      } catch (error) {
        console.error('Failed to get response:', error)
        setResult(`Error: ${parseNativeError(error).code}`)
        setTokenMetrics(undefined)
        setContextReset(session.wasContextReset)
      } finally {
        setLoading(false)
      }
    },
    [session, greedy, capTokens, reasoningLevel],
  )

  const saveTranscript = () => {
    try {
      const transcript = session.transcript
      setSavedTranscript(transcript)
      setTranscriptStatus(`Transcript saved (${transcript.length} chars)`)
    } catch (error) {
      setTranscriptStatus(`Save failed: ${(error as Error).message}`)
    }
  }

  const restoreTranscript = () => {
    if (!savedTranscript) {
      return
    }
    try {
      const restored = new LanguageModelSession({
        transcript: savedTranscript,
        tools: [weatherTool],
      })
      restored.prewarm()
      setSession(restored)
      setTranscriptStatus('Restored into a new session')
    } catch (error) {
      setTranscriptStatus(`Restore failed: ${(error as Error).message}`)
    }
  }

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
        <Text style={[styles.cardLabel, { color: mutedColor }]}>MODEL</Text>
        <Text testID="model-variant">
          {availability.variant ?? 'Variant needs iOS 27'}
        </Text>
        <Text testID="model-capabilities" style={{ color: mutedColor }}>
          {availability.capabilities?.join(', ') ?? 'Capabilities need iOS 27'}
        </Text>
      </View>
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
        <Text style={styles.rowLabel}>Reasoning</Text>
        <View style={styles.buttons}>
          {reasoningChoices.map(choice => {
            const selected = choice.level === reasoningLevel
            return (
              <TouchableOpacity
                key={choice.label}
                testID={`reasoning-${choice.label.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setReasoningLevel(choice.level)}
                style={[
                  styles.chip,
                  { borderColor: tintColor },
                  selected && { backgroundColor: tintColor },
                ]}
              >
                <Text style={{ color: selected ? '#FFFFFF' : tintColor }}>
                  {choice.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        {availability.capabilities && !availability.capabilities.includes('reasoning') ? (
          <Text style={{ color: mutedColor }}>
            This model cannot reason. A reasoning level fails with UNSUPPORTED_CAPABILITY.
          </Text>
        ) : null}
      </View>
      <View style={[styles.card, { borderColor, backgroundColor: cardColor }]}>
        <Text style={[styles.cardLabel, { color: mutedColor }]}>TRANSCRIPT</Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            testID="save-transcript"
            accessibilityRole="button"
            disabled={loading}
            onPress={saveTranscript}
            style={[styles.chip, { borderColor: tintColor, opacity: loading ? 0.4 : 1 }]}
          >
            <Text style={{ color: tintColor }}>Save transcript</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="restore-transcript"
            accessibilityRole="button"
            disabled={loading || !savedTranscript}
            onPress={restoreTranscript}
            style={[
              styles.chip,
              { borderColor: tintColor, opacity: loading || !savedTranscript ? 0.4 : 1 },
            ]}
          >
            <Text style={{ color: tintColor }}>Restore</Text>
          </TouchableOpacity>
        </View>
        <Text testID="transcript-status" style={{ color: mutedColor }}>
          {transcriptStatus}
        </Text>
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
  buttons: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
})
