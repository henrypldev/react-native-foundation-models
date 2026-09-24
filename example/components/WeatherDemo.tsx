import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  View as PlainView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card, CardLabel } from '@/components/Card'
import { ContextMeter } from '@/components/ContextMeter'
import { Text, useThemeColor, View } from '@/components/Themed'
import { useKeyboardLift } from '@/components/useKeyboardLift'
import { formatNumber } from '@/utils/formatNumber'
import type { TokenMetrics } from '@/utils/tokenMetrics'

interface UsageMetrics {
  contextSize?: number
  tokens?: TokenMetrics
  contextReset?: boolean
}

interface WeatherDemoProps {
  response: string
  isLoading: boolean
  error?: any
  onSubmit: (prompt: string) => Promise<void> | void
  onReset?: () => void
  metrics?: UsageMetrics
  title?: string
  subtitle?: string
}

const glassAvailable = isLiquidGlassAvailable()

const INPUT_BAR_GAP = 16

export function WeatherDemo({
  response,
  isLoading,
  error,
  onSubmit,
  onReset,
  metrics,
  title = 'Foundation Models',
  subtitle = 'On-device weather tool demo',
}: WeatherDemoProps) {
  const [prompt, setPrompt] = useState('')
  const insets = useSafeAreaInsets()
  const inputBarRef = useRef<PlainView>(null)
  const keyboardLift = useKeyboardLift(inputBarRef, INPUT_BAR_GAP)

  const textColor = useThemeColor({}, 'text')
  const mutedColor = useThemeColor({}, 'muted')
  const borderColor = useThemeColor({}, 'border')
  const cardColor = useThemeColor({}, 'card')
  const tintColor = useThemeColor({}, 'tint')
  const warnColor = useThemeColor({}, 'warn')
  const tokens = metrics?.tokens

  const respond = useCallback(async () => {
    const nextPrompt = prompt.trim()

    if (!nextPrompt) {
      Alert.alert('Empty prompt', 'Enter a question before sending.')
      return
    }

    Keyboard.dismiss()

    try {
      await onSubmit(nextPrompt)
      setPrompt('')
    } catch (err) {
      console.error('Error during response:', err)
    }
  }, [prompt, onSubmit])

  const canSend = !isLoading && prompt.trim().length > 0
  const InputSurface = glassAvailable ? GlassView : PlainView
  const inputSurfaceProps = glassAvailable
    ? { glassEffectStyle: 'regular' as const, isInteractive: true }
    : { style: { backgroundColor: cardColor } }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.eyebrow, { color: mutedColor }]}>
          {subtitle.toUpperCase()}
        </Text>
        <Text style={styles.title}>{title}</Text>

        <Card>
          <CardLabel>LATEST RESPONSE</CardLabel>
          <Text style={[styles.response, !response && { color: mutedColor }]}>
            {response || 'Ask about the weather to start a session.'}
          </Text>
        </Card>

        <Card>
          <CardLabel>SESSION USAGE</CardLabel>

          <ContextMeter used={contextFilled(tokens)} total={metrics?.contextSize} />

          <PlainView style={[styles.divider, { backgroundColor: borderColor }]} />

          <PlainView>
            {metricRows(tokens).map(row => (
              <PlainView key={row.label} style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: mutedColor }]}>
                  {row.label}
                </Text>
                <Text style={styles.metricValue}>{formatNumber(row.value)}</Text>
              </PlainView>
            ))}
          </PlainView>

          {tokens?.source === 'estimated' ? (
            <Text style={[styles.footnote, { color: mutedColor }]}>
              Counts are estimated on this SDK build.
            </Text>
          ) : null}

          {metrics?.contextReset ? (
            <Text style={[styles.footnote, { color: warnColor }]}>
              Context reached the limit, so it was summarised and reset.
            </Text>
          ) : null}
        </Card>
      </ScrollView>

      <PlainView
        ref={inputBarRef}
        style={[
          styles.inputBar,
          {
            // Must be a margin, not padding: `useKeyboardLift` measures this
            // view's frame, and padding would sit inside that frame and be
            // double-counted as overlap once the keyboard opens.
            marginBottom: Math.max(insets.bottom, 12) + INPUT_BAR_GAP,
            transform: [{ translateY: -keyboardLift }],
          },
        ]}
      >
        <InputSurface style={styles.inputSurface} {...(inputSurfaceProps as object)}>
          <TextInput
            value={prompt}
            onChangeText={text => {
              setPrompt(text)
              if (error && onReset) onReset()
            }}
            onSubmitEditing={() => {
              void respond()
            }}
            returnKeyType="send"
            enablesReturnKeyAutomatically
            style={[styles.input, { color: textColor }]}
            placeholder="Ask about the weather…"
            placeholderTextColor={mutedColor}
            editable={!isLoading}
            accessibilityLabel="Prompt"
          />
        </InputSurface>

        <TouchableOpacity
          onPress={() => {
            void respond()
          }}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send prompt"
          accessibilityState={{ disabled: !canSend }}
          style={[
            styles.sendButton,
            { backgroundColor: canSend ? tintColor : cardColor },
            !canSend && { borderWidth: StyleSheet.hairlineWidth, borderColor },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={mutedColor} />
          ) : (
            <Text style={[styles.sendGlyph, { color: canSend ? '#FFFFFF' : mutedColor }]}>
              ↑
            </Text>
          )}
        </TouchableOpacity>
      </PlainView>
    </View>
  )
}

function contextFilled(tokens?: TokenMetrics) {
  return tokens?.source === 'usage' ? tokens.last.totalTokens : undefined
}

function metricRows(tokens?: TokenMetrics): Array<{ label: string; value: number }> {
  switch (tokens?.source) {
    case undefined:
      return []
    case 'usage': {
      const rows = [
        { label: 'Conversation input tokens', value: tokens.last.inputTokens },
        { label: 'Cached input tokens', value: tokens.last.cachedInputTokens },
        { label: 'Output tokens', value: tokens.last.outputTokens },
        { label: 'Reasoning tokens', value: tokens.last.reasoningTokens },
        { label: 'Context filled', value: tokens.last.totalTokens },
      ]
      return tokens.sessionTotal === undefined
        ? rows
        : [...rows, { label: 'Session total', value: tokens.sessionTotal }]
    }
    case 'counted':
    case 'estimated':
      return [
        { label: 'Prompt tokens', value: tokens.promptTokens },
        { label: 'Response tokens', value: tokens.responseTokens },
      ]
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
    marginTop: -8,
  },
  response: {
    fontSize: 17,
    lineHeight: 24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 6,
  },
  metricLabel: {
    fontSize: 15,
  },
  metricValue: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  inputSurface: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    minHeight: 44,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 17,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendGlyph: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  },
})
