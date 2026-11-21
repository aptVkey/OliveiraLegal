import { requireMember } from '@/lib/auth'
import { ROLES } from '@/lib/roles'
import { Sidebar } from './sidebar'

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember()
  return <Sidebar name={member.fullName} role={ROLES[member.role]}>{children}</Sidebar>
}
