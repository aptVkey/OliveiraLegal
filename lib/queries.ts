import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function getMembers() {
  const db = await createClient()
  const { data } = await db.from('profiles').select('id, full_name, role, active').eq('active', true).order('full_name')
  return (data ?? []) as { id: string; full_name: string; role: string; active: boolean }[]
}

export async function getAreas() {
  const db = await createClient()
  const { data } = await db.from('practice_areas').select('id, name, active').order('name')
  return (data ?? []) as { id: string; name: string; active: boolean }[]
}

export async function getClientsLite() {
  const db = await createClient()
  const { data } = await db.from('clients').select('id, name').eq('archived', false).order('name')
  return (data ?? []) as { id: string; name: string }[]
}

export async function getOpenCasesLite() {
  const db = await createClient()
  const { data } = await db.from('cases').select('id, reference, title').neq('status', 'fechado').order('reference', { ascending: false })
  return (data ?? []) as { id: string; reference: string; title: string }[]
}
