import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native'
import {
  checkFoundationModelsAvailability,
  type GenerationOptions,
  LanguageModelSession,
  parseNativeError,
  type ReasoningLevel,
} from 'react-native-foundation-models'
import { Card, CardLabel, Chip, ChipRow } from '@/components/Card'
import { DemoScreen } from '@/components/DemoScreen'
import { Text, useThemeColor } from '@/components/Themed'

const PROMPT = 'Explain why the sky is blue.'
const MAXIMUM_RESPONSE_TOKENS = 30

const reasoningChoices: Array<{ label: string; level?: ReasoningLevel }> = [
  { label: 'Off' },
  { label: 'Light', level: 'light' },
  { label: 'Moderate', level: 'moderate' },
  { label: 'Deep', level: 'deep' },
]

export default function OptionsDemoScreen() {
  const mutedColor = useThemeColor({}, 'muted')
  const [availability] = useState(checkFoundationModelsAvailability)
  const [options, setOptions] = useState<GenerationOptions>({})
  const [response, setResponse] = useState('')
  const [status, setStatus] = useState('Pick options, then send the prompt')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    setLoading(true)
    setResponse('')
    setStatus('Responding')
    try {
      const session = new LanguageModelSession({
        instructions: 'You answer in plain language.',
      })
      setResponse(await session.respond(PROMPT, options))
      const usage = session.lastResponseUsage
      setStatus(
        usage
          ? `${usage.outputTokens} output tokens, ${usage.reasoningTokens} reasoning tokens`
          : 'Done',
      )
    } catch (error) {
      setStatus(`Error: ${parseNativeError(error).code}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DemoScreen eyebrow="GENERATION OPTIONS" title="Options">
      <Card>
        <CardLabel>MODEL</CardLabel>
        <Text testID="model-variant">
          {availability.variant ?? 'Variant needs iOS 27'}
        </Text>
        <Text testID="model-capabilities" style={{ color: mutedColor }}>
          {availability.capabilities?.join(', ') ?? 'Capabilities need iOS 27'}
        </Text>
      </Card>

      <Card>
        <CardLabel>OPTIONS</CardLabel>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Greedy sampling</Text>
          <Switch
            testID="generation-greedy-toggle"
            accessibilityLabel="Greedy sampling"
            value={options.samplingMode?.kind === 'greedy'}
            onValueChange={greedy =>
              setOptions(current => ({
                ...current,
                samplingMode: greedy ? { kind: 'greedy' } : undefined,
              }))
            }
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Cap at {MAXIMUM_RESPONSE_TOKENS} tokens</Text>
          <Switch
            testID="generation-max-tokens-toggle"
            accessibilityLabel={`Cap at ${MAXIMUM_RESPONSE_TOKENS} tokens`}
            value={options.maximumResponseTokens !== undefined}
            onValueChange={cap =>
              setOptions(current => ({
                ...current,
                maximumResponseTokens: cap ? MAXIMUM_RESPONSE_TOKENS : undefined,
              }))
            }
          />
        </View>
        <Text style={styles.rowLabel}>Reasoning</Text>
        <ChipRow>
          {reasoningChoices.map(choice => (
            <Chip
              key={choice.label}
              testID={`reasoning-${choice.label.toLowerCase()}`}
              label={choice.label}
              selected={choice.level === options.reasoningLevel}
              onPress={() =>
                setOptions(current => ({ ...current, reasoningLevel: choice.level }))
              }
            />
          ))}
        </ChipRow>
        {availability.capabilities && !availability.capabilities.includes('reasoning') ? (
          <Text style={{ color: mutedColor }}>
            This model cannot reason. A reasoning level fails with UNSUPPORTED_CAPABILITY.
          </Text>
        ) : null}
      </Card>

      <Card>
        <CardLabel>PROMPT</CardLabel>
        <Text>{PROMPT}</Text>
        <ChipRow>
          <Chip
            testID="options-send"
            label="Send prompt"
            disabled={loading}
            onPress={send}
          />
        </ChipRow>
      </Card>

      <Card>
        <View style={styles.row}>
          <CardLabel testID="options-status">{status.toUpperCase()}</CardLabel>
          {loading ? <ActivityIndicator size="small" /> : null}
        </View>
        <Text testID="options-response">{response}</Text>
      </Card>
    </DemoScreen>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 15,
  },
})
