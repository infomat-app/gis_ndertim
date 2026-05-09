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

  const { data: layers } = await supabase
    .from('layers')
    .select('*, fields:layer_fields(*)')
    .eq('geom_type', 'Point')   // Field form: vetëm pikat
    .order('sort_order')

  return <FieldCollector profile={profile} layers={layers ?? []} />
}
