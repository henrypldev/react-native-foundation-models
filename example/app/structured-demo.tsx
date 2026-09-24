import { useCallback, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import {
  type AppleAIError,
  type DeepPartial,
  isAppleAIError,
  LanguageModelSession,
  parseNativeError,
} from 'react-native-foundation-models'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'
import { Text, useThemeColor, View } from '@/components/Themed'

const Recipe = z.object({
  title: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  minutes: z.number().int().min(1).max(240).describe('Total time in minutes'),
  ingredients: z
    .array(z.object({ name: z.string(), quantity: z.string() }))
    .min(2)
    .max(8),
  steps: z.array(z.string()).min(1).max(6),
})

type Recipe = z.infer<typeof Recipe>

const PROMPTS = [
  'A quick pasta recipe',
  'A vegan breakfast bowl',
  'A hard French dessert',
]

const session = new LanguageModelSession({
  instructions: 'You write short, practical recipes.',
})

export default function StructuredDemoScreen() {
  const insets = useSafeAreaInsets()
  const mutedColor = useThemeColor({}, 'muted')
  const borderColor = useThemeColor({}, 'border')
  const cardColor = useThemeColor({}, 'card')
  const tintColor = useThemeColor({}, 'tint')
  const dangerColor = useThemeColor({}, 'danger')

  const [partial, setPartial] = useState<DeepPartial<Recipe>>({})
  const [snapshots, setSnapshots] = useState(0)
  const [recipe, setRecipe] = useState<Recipe>()
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<AppleAIError>()

  const generate = useCallback(async (prompt: string) => {
    setPartial({})
    setSnapshots(0)
    setRecipe(undefined)
    setError(undefined)
    setIsStreaming(true)
    try {
      const result = await session.streamResponse(
        prompt,
        next => {
          setPartial(next)
          setSnapshots(count => count + 1)
        },
        { schema: Recipe },
      )
      setRecipe(result)
    } catch (err) {
      setError(isAppleAIError(err) ? err : parseNativeError(err))
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const shown = recipe ?? partial
  const status = error
    ? error.code
    : recipe
      ? `Validated after ${snapshots} snapshots`
      : isStreaming
        ? `Streaming, ${snapshots} snapshots`
        : 'Pick a prompt'

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      testID="structured-scroll"
    >
      <Text style={[styles.eyebrow, { color: mutedColor }]}>ZOD SCHEMA OUTPUT</Text>
      <Text style={styles.title}>Structured</Text>

      <View style={styles.prompts}>
        {PROMPTS.map(prompt => (
          <TouchableOpacity
            key={prompt}
            accessibilityRole="button"
            disabled={isStreaming}
            onPress={() => generate(prompt)}
            style={[
              styles.chip,
              { borderColor: tintColor, opacity: isStreaming ? 0.4 : 1 },
            ]}
          >
            <Text style={{ color: tintColor }}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.card, { borderColor, backgroundColor: cardColor }]}>
        <View style={[styles.statusRow, { backgroundColor: 'transparent' }]}>
          <Text
            testID="structured-status"
            style={[styles.cardLabel, { color: error ? dangerColor : mutedColor }]}
          >
            {status.toUpperCase()}
          </Text>
          {isStreaming ? <ActivityIndicator size="small" /> : null}
        </View>

        {error ? <Text style={{ color: dangerColor }}>{error.message}</Text> : null}

        <Text style={styles.recipeTitle}>{shown.title || ' '}</Text>
        <Field label="Difficulty" value={shown.difficulty} mutedColor={mutedColor} />
        <Field
          label="Minutes"
          value={shown.minutes === undefined ? undefined : String(shown.minutes)}
          mutedColor={mutedColor}
        />

        <Text style={[styles.cardLabel, { color: mutedColor }]}>INGREDIENTS</Text>
        <Text style={styles.list}>
          {(shown.ingredients ?? [])
            .map(({ quantity = '', name = '' }) => `• ${quantity} ${name}`.trimEnd())
            .join('\n')}
        </Text>

        <Text style={[styles.cardLabel, { color: mutedColor }]}>STEPS</Text>
        <Text style={styles.list}>
          {(shown.steps ?? []).map((step, index) => `${index + 1}. ${step}`).join('\n')}
        </Text>
      </View>

      <View style={[styles.card, { borderColor, backgroundColor: cardColor }]}>
        <Text style={[styles.cardLabel, { color: mutedColor }]}>
          {recipe ? 'PARSED VALUE' : 'LATEST SNAPSHOT'}
        </Text>
        <Text testID="structured-json" style={styles.json}>
          {JSON.stringify(shown, null, 2)}
        </Text>
      </View>
    </ScrollView>
  )
}

function Field({
  label,
  value,
  mutedColor,
}: {
  label: string
  value?: string
  mutedColor: string
}) {
  return (
    <View style={[styles.statusRow, { backgroundColor: 'transparent' }]}>
      <Text style={{ color: mutedColor }}>{label}</Text>
      <Text>{value || '…'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
  },
  prompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: '600',
  },
  list: {
    lineHeight: 24,
  },
  json: {
    fontFamily: 'Menlo',
    fontSize: 12,
  },
})
