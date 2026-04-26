import { useEffect, useState } from 'react'

export function MeetingsView(): React.JSX.Element {
  const [active, setActive] = useState<EsiActiveMeeting | null>(null)

  useEffect(() => {
    const refresh = async (): Promise<void> => {
      try {
        const m = await window.esi?.getActiveMeeting()
        setActive(m ?? null)
      } catch {
        /* noop */
      }
    }
    refresh()
    const id = setInterval(refresh, 3_000)
    const off = window.esi?.onMeetingTranscript?.(() => refresh())
    const off2 = window.esi?.onMeetingEnd?.(() => refresh())
    const off3 = window.esi?.onMeetingStart?.(() => refresh())
    return () => {
      clearInterval(id)
      off?.()
      off2?.()
      off3?.()
    }
  }, [])

  return (
    <div
      className="panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: 1
      }}
    >
      <div className="panel-head">
        <span>
          <span className="dot" />
          MEETINGS · {active ? 'LIVE' : 'STANDBY'}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 9,
            color: active ? 'var(--color-esi-good)' : 'var(--color-esi-fg-dim)'
          }}
        >
          {active
            ? `CAPTURING ${active.app.toUpperCase()}`
            : 'NO ACTIVE MEETING'}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
      >
        {!active && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--color-esi-fg-dim)',
              letterSpacing: '0.1em',
              lineHeight: 1.6
            }}
          >
            <div style={{ color: 'var(--color-esi-c-100)', marginBottom: 6 }}>
              READY TO CAPTURE
            </div>
            When you join a meeting (Zoom, Google Meet, FaceTime, Teams),
            Queen Esi auto-detects it and begins transcribing via Whisper.
            Transcripts and auto-summary appear here live.
          </div>
        )}

        {active && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 11
              }}
            >
              <Stat label="APP" value={active.app} accent />
              <Stat
                label="DURATION"
                value={`${Math.max(
                  1,
                  Math.round((Date.now() - active.startedAt) / 60000)
                )}m`}
              />
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                color: 'var(--color-esi-fg-dim)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase'
              }}
            >
              Live transcript
            </div>
            <div
              style={{
                border: '1px solid rgba(126,231,255,0.15)',
                borderLeft: '2px solid var(--color-esi-c-200)',
                padding: '12px 14px',
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--color-esi-fg)',
                whiteSpace: 'pre-wrap',
                background: 'rgba(126,231,255,0.03)'
              }}
              data-selectable
            >
              {active.transcript.trim() ||
                'Listening — transcript will appear as the meeting progresses…'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent
}: {
  label: string
  value: string
  accent?: boolean
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: '10px 12px',
        border: '1px solid rgba(126,231,255,0.15)',
        background: 'rgba(126,231,255,0.03)'
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: 'var(--color-esi-fg-dim)',
          letterSpacing: '0.2em'
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: accent ? 'var(--color-esi-c-100)' : 'var(--color-esi-fg)',
          fontSize: 16,
          fontWeight: 600,
          marginTop: 2
        }}
      >
        {value}
      </div>
    </div>
  )
}
