import { StyleSheet, TouchableOpacity, View, type ViewProps } from 'react-native'
import { Text, type TextProps, useThemeColor } from '@/components/Themed'

export function Card({ style, ...props }: ViewProps) {
  const borderColor = useThemeColor({}, 'border')
  const backgroundColor = useThemeColor({}, 'card')

  return (
    <View style={[styles.card, { borderColor, backgroundColor }, style]} {...props} />
  )
}

export function CardLabel({ style, ...props }: TextProps) {
  const color = useThemeColor({}, 'muted')

  return <Text style={[styles.cardLabel, { color }, style]} {...props} />
}

export function ChipRow({ style, ...props }: ViewProps) {
  return <View style={[styles.chipRow, style]} {...props} />
}

interface ChipProps {
  label: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
  testID?: string
}

export function Chip({
  label,
  onPress,
  selected = false,
  disabled = false,
  testID,
}: ChipProps) {
  const tintColor = useThemeColor({}, 'tint')

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: tintColor, opacity: disabled ? 0.4 : 1 },
        selected && { backgroundColor: tintColor },
      ]}
    >
      <Text style={{ color: selected ? '#FFFFFF' : tintColor }}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
})
