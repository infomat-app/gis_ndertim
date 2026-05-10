export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import FieldCollector from '@/components/field/FieldCollector'

export default async function FieldRoute() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (!profile) redirect('/login')
  if (profile.role === 'viewer') redirect('/map')

  const { data: rawLayers } = await supabase
    .from('layers')
    .select('*, fields:layer_fields(*)')
    .eq('geom_type', 'Point')
    .order('sort_order')

  // Filter layers by per-user permissions (admins skip — always full access)
  let layers = rawLayers ?? []
  if (profile.role !== 'admin') {
    const { data: perms } = await supabase
      .from('layer_permissions')
      .select('layer_id, permission')
      .eq('user_id', profile.id)
    const permMap: Record<string, string> = {}
    for (const p of perms ?? []) permMap[p.layer_id] = p.permission

    layers = layers.filter(l => {
      const specific = permMap[l.id]
      if (specific !== undefined) return specific === 'edit'
      return true // role default: field/editor/admin can add features
    })
  }

  return <FieldCollector profile={profile} layers={layers} />
}
