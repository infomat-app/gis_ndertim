export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import AdminPanel from '@/components/admin/AdminPanel'

export default async function AdminRoute() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (!profile || profile.role !== 'admin') redirect('/map')

  const { data: users  } = await supabase.from('profiles').select('*').order('created_at')
  const { data: layers } = await supabase
    .from('layers')
    .select('*, fields:layer_fields(*)')
    .order('sort_order')

  return (
    <AdminPanel
      profile={profile}
      initialUsers={users ?? []}
      initialLayers={layers ?? []}
    />
  )
}
