import { motion } from 'framer-motion'
import { PanelShell } from '../shared/PanelShell'

const BAR_COUNT = 48

export function VoiceWaveform({ delay = 0 }: { delay?: number }): React.JSX.Element {
  return (
    <PanelShell title="Voice" accent="cyan" live delay={delay}>
      <div className="flex items-center justify-center gap-[3px] h-16">
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <motion.span
            key={i}
            className="inline-block w-[3px] rounded-full"
            style={{ background: 'var(--color-esi-cyan)' }}
            animate={{
              height: [
                `${10 + Math.random() * 10}%`,
                `${30 + Math.random() * 60}%`,
                `${10 + Math.random() * 10}%`
              ],
              opacity: [0.4, 1, 0.4]
            }}
            transition={{
              duration: 0.9 + Math.random() * 0.6,
              repeat: Infinity,
              delay: i * 0.02,
              ease: 'easeInOut'
            }}
          />
        ))}
      </div>
      <div
        className="text-center text-[11px] mt-3 tracking-[0.3em] uppercase"
        style={{ color: 'var(--color-esi-muted)' }}
      >
        Idle · waiting for wake word
      </div>
    </PanelShell>
  )
}
