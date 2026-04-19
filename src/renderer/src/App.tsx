import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { HUDFullscreen } from './components/HUD/HUDFullscreen'
import { HUDSidebar } from './components/HUD/HUDSidebar'

type Mode = 'fullscreen' | 'sidebar'

function App(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('fullscreen')

  useEffect(() => {
    const off = window.esi?.onMode((m) => setMode(m))
    return () => off?.()
  }, [])

  async function toggleMode(): Promise<void> {
    const next = await window.esi?.toggleMode()
    if (next) setMode(next)
  }

  return (
    <AnimatePresence mode="wait">
      {mode === 'fullscreen' ? (
        <HUDFullscreen key="full" onToggleMode={toggleMode} />
      ) : (
        <HUDSidebar key="side" onToggleMode={toggleMode} />
      )}
    </AnimatePresence>
  )
}

export default App
