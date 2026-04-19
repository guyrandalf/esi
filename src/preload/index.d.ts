declare global {
  interface Window {
    esi: {
      sendCommand: (text: string) => Promise<{ ok: boolean; response: string }>
      toggleMode: () => Promise<'fullscreen' | 'sidebar'>
      setInteractive: (interactive: boolean) => Promise<void>
      onMode: (cb: (mode: 'fullscreen' | 'sidebar') => void) => () => void
    }
  }
}

export {}
