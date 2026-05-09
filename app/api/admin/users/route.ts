import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

async function assertAdmin() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return p?.role === 'admin' ? user : null
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY mungon në .env.local' }, { status: 500 })
  }
  const caller = await assertAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { email, password, full_name, role } = await req.json()
  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Email, emri dhe fjalëkalimi janë të detyrueshme' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('profiles').upsert({
    id: data.user.id,
    email,
    full_name,
    role: role ?? 'viewer',
    updated_at: new Date().toISOString(),
  })

  const { data: profile } = await admin.from('profiles').select('*').eq('id', data.user.id).single()
  return NextResponse.json({ user: profile })
}
