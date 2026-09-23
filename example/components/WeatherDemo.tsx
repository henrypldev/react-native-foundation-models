import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { type ReactNode, useCallback, useRef, useState } from 'react'
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
  children?: ReactNode
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
  children,
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

        <View style={[styles.card, { borderColor, backgroundColor: cardColor }]}>
          <Text style={[styles.cardLabel, { color: mutedColor }]}>LATEST RESPONSE</Text>
          <Text style={[styles.response, !response && { color: mutedColor }]}>
            {response || 'Ask about the weather to start a session.'}
          </Text>
        </View>

        {children}

        <View style={[styles.card, { borderColor, backgroundColor: cardColor }]}>
          <Text style={[styles.cardLabel, { color: mutedColor }]}>SESSION USAGE</Text>

          <ContextMeter
            used={metrics?.tokens?.totalTokens}
            total={metrics?.contextSize}
          />

          <PlainView style={[styles.divider, { backgroundColor: borderColor }]} />

          <MetricRow
            label="Input tokens"
            value={formatNumber(metrics?.tokens?.inputTokens)}
            mutedColor={mutedColor}
          />
          {metrics?.tokens?.cachedInputTokens !== undefined ? (
            <MetricRow
              label="Cached input tokens"
              value={formatNumber(metrics.tokens.cachedInputTokens)}
              mutedColor={mutedColor}
            />
          ) : null}
          <MetricRow
            label="Output tokens"
            value={formatNumber(metrics?.tokens?.outputTokens)}
            mutedColor={mutedColor}
          />
          {metrics?.tokens?.reasoningTokens !== undefined ? (
            <MetricRow
              label="Reasoning tokens"
              value={formatNumber(metrics.tokens.reasoningTokens)}
              mutedColor={mutedColor}
            />
          ) : null}
          <MetricRow
            label="Total tokens"
            value={formatNumber(metrics?.tokens?.totalTokens)}
            mutedColor={mutedColor}
          />
          {metrics?.tokens?.sessionTokens !== undefined ? (
            <MetricRow
              label="Session total"
              value={formatNumber(metrics.tokens.sessionTokens)}
              mutedColor={mutedColor}
            />
          ) : null}

          {metrics?.tokens?.estimated === true ? (
            <Text style={[styles.footnote, { color: mutedColor }]}>
              Counts are estimated on this SDK build.
            </Text>
          ) : null}

          {metrics?.contextReset ? (
            <Text style={[styles.footnote, { color: warnColor }]}>
              Context reached the limit, so it was summarised and reset.
            </Text>
          ) : null}
        </View>
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

function MetricRow({
  label,
  value,
  mutedColor,
}: {
  label: string
  value: string
  mutedColor: string
}) {
  return (
    <PlainView style={styles.metricRow}>
      <Text style={[styles.metricLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </PlainView>
  )
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
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  response: {
    fontSize: 17,
    lineHeight: 24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
    marginBottom: 4,
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
    marginTop: 12,
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
