import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import {
  LanguageModelSession,
  parseNativeError,
  type SerializedTranscript,
} from 'react-native-foundation-models'
import { Card, CardLabel, Chip, ChipRow } from '@/components/Card'
import { DemoScreen } from '@/components/DemoScreen'
import { Text, useThemeColor } from '@/components/Themed'

const INSTRUCTIONS = 'You are a helpful assistant. Answer in one sentence.'
const INTRO_PROMPT = 'My name is Ada and I like sailing.'
const FOLLOW_UP_PROMPT = 'What is my name, and what do I like?'

export default function TranscriptDemoScreen() {
  const mutedColor = useThemeColor({}, 'muted')
  const [session, setSession] = useState(
    () => new LanguageModelSession({ instructions: INSTRUCTIONS }),
  )
  const [savedTranscript, setSavedTranscript] = useState<SerializedTranscript>()
  const [status, setStatus] = useState('No transcript saved')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const ask = async (prompt: string) => {
    setLoading(true)
    setResponse('')
    try {
      setResponse(await session.respond(prompt))
    } catch (error) {
      setResponse(`Error: ${parseNativeError(error).code}`)
    } finally {
      setLoading(false)
    }
  }

  const saveTranscript = () => {
    try {
      const transcript = session.transcript
      setSavedTranscript(transcript)
      setStatus(`Transcript saved (${transcript.length} chars)`)
    } catch (error) {
      setStatus(`Save failed: ${parseNativeError(error).code}`)
    }
  }

  const restoreTranscript = () => {
    if (!savedTranscript) {
      return
    }
    try {
      setSession(new LanguageModelSession({ transcript: savedTranscript }))
      setResponse('')
      setStatus('Restored into a new session')
    } catch (error) {
      setStatus(`Restore failed: ${parseNativeError(error).code}`)
    }
  }

  return (
    <DemoScreen eyebrow="SAVE AND RESTORE" title="Transcript">
      <Card>
        <CardLabel>STEPS</CardLabel>
        <Text style={{ color: mutedColor }}>
          {`1. Send intro: "${INTRO_PROMPT}"\n2. Save transcript\n3. Restore\n4. Ask follow-up: "${FOLLOW_UP_PROMPT}"`}
        </Text>
        <ChipRow>
          <Chip
            testID="transcript-intro"
            label="Send intro"
            disabled={loading}
            onPress={() => ask(INTRO_PROMPT)}
          />
          <Chip
            testID="save-transcript"
            label="Save transcript"
            disabled={loading}
            onPress={saveTranscript}
          />
          <Chip
            testID="restore-transcript"
            label="Restore"
            disabled={loading || !savedTranscript}
            onPress={restoreTranscript}
          />
          <Chip
            testID="transcript-follow-up"
            label="Ask follow-up"
            disabled={loading}
            onPress={() => ask(FOLLOW_UP_PROMPT)}
          />
        </ChipRow>
        <Text testID="transcript-status" style={{ color: mutedColor }}>
          {status}
        </Text>
      </Card>

      <Card>
        <View style={styles.row}>
          <CardLabel>LATEST RESPONSE</CardLabel>
          {loading ? <ActivityIndicator size="small" /> : null}
        </View>
        <Text testID="transcript-response">{response}</Text>
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
})
