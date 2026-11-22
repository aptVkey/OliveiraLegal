import { requireMember } from '@/lib/auth'
import { ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from './sidebar'

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember()
  const db = await createClient()
  const { data: running } = await db.from('time_entries')
    .select('started_at, description, task:tasks(title), case:cases(reference)')
    .eq('member_id', member.id).is('ended_at', null).maybeSingle()

  return (
    <Sidebar
      name={member.fullName}
      role={member.role}
      roleLabel={ROLES[member.role]}
      running={running ? { started_at: running.started_at, label: [(running.case as any)?.reference, (running.task as any)?.title ?? running.description].filter(Boolean).join(' · ') || 'Tempo interno' } : null}
    >
      {children}
    </Sidebar>
  )
}
