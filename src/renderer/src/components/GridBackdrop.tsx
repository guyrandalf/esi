export function GridBackdrop(): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(var(--color-esi-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-esi-grid) 1px, transparent 1px),
          radial-gradient(ellipse at center, rgba(126,231,255,0.06) 0%, transparent 70%)
        `,
        backgroundSize: '60px 60px, 60px 60px, 100% 100%',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  )
}

export function Scanlines(): React.JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage:
          'repeating-linear-gradient(to bottom, rgba(126,231,255,0.015) 0px, rgba(126,231,255,0.015) 1px, transparent 1px, transparent 3px)',
        zIndex: 9998,
        mixBlendMode: 'screen'
      }}
    />
  )
}

export function Vignette(): React.JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background:
          'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
        zIndex: 9997
      }}
    />
  )
}
