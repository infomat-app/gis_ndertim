export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import ReportsPage from '@/components/reports/ReportsPage'

export default async function ReportsRoute() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.role === 'field') redirect('/field')

  return <ReportsPage profile={profile} />
}
