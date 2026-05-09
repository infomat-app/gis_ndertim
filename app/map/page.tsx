import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import MapPage from '@/components/map/MapPage'

export default async function MapRoute() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: layers } = await supabase
    .from('layers')
    .select('*, fields:layer_fields(*)')
    .order('sort_order', { ascending: true })
    .order('created_at', { referencedTable: 'layer_fields', ascending: true })

  return <MapPage profile={profile} initialLayers={layers ?? []} />
}
