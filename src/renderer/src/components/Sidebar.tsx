import { CalendarStrip } from './panels/CalendarStrip'
import { MemoryPanel } from './panels/MemoryPanel'
import { ActiveTask } from './panels/ActiveTask'
import { PanelShell } from './shared/PanelShell'

export function Sidebar(): React.JSX.Element {
  return (
    <>
      <PanelShell title="Calendar Integration" glowColor="gold" className="flex-none max-h-[200px]" delay={0.1}>
        <CalendarStrip />
      </PanelShell>
      
      <PanelShell title="Semantic Memory" glowColor="violet" className="flex-1 min-h-0" delay={0.2}>
        <MemoryPanel />
      </PanelShell>
      
      <PanelShell title="Active Task Context" glowColor="green" className="flex-none max-h-[300px]" delay={0.3}>
        <ActiveTask />
      </PanelShell>
    </>
  )
}
