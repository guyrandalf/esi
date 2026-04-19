import { useEffect, useState } from 'react'
import { ConversationView } from './ConversationView'
import { InputBar } from './InputBar'
import { ActivityColumn } from './ActivityColumn'
import { MeetingOverlay } from './MeetingOverlay'
import { SettingsModal } from './SettingsModal'
import { TopBar, type TabId } from './TopBar'
import { BootSequence } from './BootSequence'
import { BottomTicker } from './BottomTicker'
import { GridBackdrop, Scanlines, Vignette } from './GridBackdrop'
import { ArcReactor, type VoiceState } from './panels/ArcReactor'
import { ClockPanel } from './panels/ClockPanel'
import { ActiveTask } from './panels/ActiveTask'
import { MetricsPanel } from './panels/MetricsPanel'
import { CalendarStrip } from './panels/CalendarStrip'
import { SubsystemDiagnostic } from './panels/SubsystemDiagnostic'
import { InputLevel } from './panels/InputLevel'
import { PanelShell } from './shared/PanelShell'
import { MemoryView } from './views/MemoryView'
import { MeetingsView } from './views/MeetingsView'
import { ArchiveView } from './views/ArchiveView'

export function AppShell(): React.JSX.Element {
  const [booted, setBooted] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [currentTab, setCurrentTab] = useState<TabId>('overview')

  async function handleSubmit(text: string): Promise<void> {
    setThinking(true)
    setVoiceState('thinking')
    try {
      await window.esi?.sendCommand(text)
    } finally {
      setThinking(false)
      setVoiceState((prev) => (prev === 'thinking' ? 'idle' : prev))
    }
  }

  // Settings hotkey
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Voice state from hotkey-driven capture and TTS playback
  useEffect(() => {
    const off = window.esi?.onVoiceState?.((s) => {
      if (s === 'recording') setVoiceState('listening')
      else if (s === 'transcribing') setVoiceState('thinking')
      else if (s === 'speaking') setVoiceState('speaking')
      else setVoiceState('idle')
    })
    return () => off?.()
  }, [])

  if (!booted) {
    return <BootSequence onDone={() => setBooted(true)} />
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--color-esi-bg-0)'
      }}
    >
      <GridBackdrop />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <TopBar
          voiceState={voiceState}
          currentTab={currentTab}
          onTab={setCurrentTab}
          onSettings={() => setSettingsOpen(true)}
        />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {currentTab === 'overview' && (
            <OverviewLayout thinking={thinking} voiceState={voiceState} />
          )}
          {currentTab === 'memory' && <SingleLayout><MemoryView /></SingleLayout>}
          {currentTab === 'meetings' && <SingleLayout><MeetingsView /></SingleLayout>}
          {currentTab === 'archive' && <SingleLayout><ArchiveView /></SingleLayout>}
        </div>

        {/* Input bar — pinned between the grid and the ticker */}
        <div
          style={{
            padding: '0 16px 12px',
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <div style={{ width: '100%', maxWidth: 760 }}>
            <InputBar
              onSubmit={handleSubmit}
              thinking={thinking}
              voiceState={voiceState}
            />
          </div>
        </div>

        <BottomTicker />
      </div>

      <Scanlines />
      <Vignette />

      <MeetingOverlay />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function OverviewLayout({
  thinking,
  voiceState
}: {
  thinking: boolean
  voiceState: VoiceState
}): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns:
          'minmax(280px, 320px) minmax(0, 1fr) minmax(340px, 380px)',
        gap: 16,
        padding: 16,
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      {/* LEFT · Clock · ActiveTask · Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr',
          gap: 16,
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        <ClockPanel />
        <PanelShell title="Active Task Context">
          <ActiveTask />
        </PanelShell>
        <div style={{ minHeight: 0, overflow: 'auto' }}>
          <MetricsPanel />
        </div>
      </div>

      {/* CENTER · ArcReactor · InputLevel · Subsystem diagnostic */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'minmax(0, 1fr) auto auto',
          gap: 16,
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            minHeight: 0,
            minWidth: 0
          }}
        >
          <ArcReactor state={voiceState} />
        </div>
        <InputLevel state={voiceState} />
        <SubsystemDiagnostic />
      </div>

      {/* RIGHT · Conversation · Agenda · MissionLog */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'minmax(0, 1.3fr) auto minmax(0, 1fr)',
          gap: 16,
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        <ConversationView thinking={thinking} />
        <CalendarStrip />
        <ActivityColumn />
      </div>
    </div>
  )
}

function SingleLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        padding: 16,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {children}
    </div>
  )
}
