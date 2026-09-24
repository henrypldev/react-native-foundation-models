import type { ReactNode } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text, useThemeColor } from '@/components/Themed'

interface DemoScreenProps {
  eyebrow: string
  title: string
  testID?: string
  children: ReactNode
}

export function DemoScreen({ eyebrow, title, testID, children }: DemoScreenProps) {
  const insets = useSafeAreaInsets()
  const mutedColor = useThemeColor({}, 'muted')

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      testID={testID}
    >
      <Text style={[styles.eyebrow, { color: mutedColor }]}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
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
})
