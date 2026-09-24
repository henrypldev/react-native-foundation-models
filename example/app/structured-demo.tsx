import { useCallback, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import {
  type AppleAIError,
  type DeepPartial,
  LanguageModelSession,
  parseNativeError,
} from 'react-native-foundation-models'
import { z } from 'zod'
import { Card, CardLabel, Chip, ChipRow } from '@/components/Card'
import { DemoScreen } from '@/components/DemoScreen'
import { Text, useThemeColor } from '@/components/Themed'

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

function describeStatus(
  error: AppleAIError | undefined,
  recipe: Recipe | undefined,
  isStreaming: boolean,
  snapshots: number,
) {
  if (error) return error.code
  if (recipe) return `Validated after ${snapshots} snapshots`
  if (isStreaming) return `Streaming, ${snapshots} snapshots`
  return 'Pick a prompt'
}

export default function StructuredDemoScreen() {
  const mutedColor = useThemeColor({}, 'muted')
  const dangerColor = useThemeColor({}, 'danger')
  const [session] = useState(
    () =>
      new LanguageModelSession({ instructions: 'You write short, practical recipes.' }),
  )
  const [partial, setPartial] = useState<DeepPartial<Recipe>>({})
  const [snapshots, setSnapshots] = useState(0)
  const [recipe, setRecipe] = useState<Recipe>()
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<AppleAIError>()

  const generate = useCallback(
    async (prompt: string) => {
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
        setError(parseNativeError(err))
      } finally {
        setIsStreaming(false)
      }
    },
    [session],
  )

  const shown = recipe ?? partial
  const status = describeStatus(error, recipe, isStreaming, snapshots)

  return (
    <DemoScreen eyebrow="ZOD SCHEMA OUTPUT" title="Structured" testID="structured-scroll">
      <ChipRow>
        {PROMPTS.map(prompt => (
          <Chip
            key={prompt}
            label={prompt}
            disabled={isStreaming}
            onPress={() => generate(prompt)}
          />
        ))}
      </ChipRow>

      <Card>
        <View style={styles.statusRow}>
          <CardLabel testID="structured-status" style={error && { color: dangerColor }}>
            {status.toUpperCase()}
          </CardLabel>
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

        <CardLabel>INGREDIENTS</CardLabel>
        <Text style={styles.list}>
          {(shown.ingredients ?? [])
            .map(({ quantity = '', name = '' }) => `• ${quantity} ${name}`.trimEnd())
            .join('\n')}
        </Text>

        <CardLabel>STEPS</CardLabel>
        <Text style={styles.list}>
          {(shown.steps ?? []).map((step, index) => `${index + 1}. ${step}`).join('\n')}
        </Text>
      </Card>

      <Card>
        <CardLabel>{recipe ? 'PARSED VALUE' : 'LATEST SNAPSHOT'}</CardLabel>
        <Text testID="structured-json" style={styles.json}>
          {JSON.stringify(shown, null, 2)}
        </Text>
      </Card>
    </DemoScreen>
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
    <View style={styles.statusRow}>
      <Text style={{ color: mutedColor }}>{label}</Text>
      <Text>{value || '…'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
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
