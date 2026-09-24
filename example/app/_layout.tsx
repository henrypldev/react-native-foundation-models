import 'expo-dev-client'
import 'react-native-reanimated'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useColorScheme } from '@/components/useColorScheme'
import Colors from '@/constants/Colors'

export { ErrorBoundary } from 'expo-router'

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const theme = colorScheme === 'dark' ? 'dark' : 'light'

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <NativeTabs minimizeBehavior="onScrollDown" tintColor={Colors[theme].tint}>
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Icon
              sf={{ default: 'text.bubble', selected: 'text.bubble.fill' }}
            />
            <NativeTabs.Trigger.Label>Original</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="streaming-demo">
            <NativeTabs.Trigger.Icon sf="waveform" />
            <NativeTabs.Trigger.Label>Streaming</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="hook-demo">
            <NativeTabs.Trigger.Icon sf="curlybraces" />
            <NativeTabs.Trigger.Label>Hook</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="structured-demo">
            <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" />
            <NativeTabs.Trigger.Label>Structured</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="+not-found" hidden />
        </NativeTabs>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
