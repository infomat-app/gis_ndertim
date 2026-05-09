'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, Layer } from '@/lib/types'
import Navbar from '@/components/ui/Navbar'

const ROLES = ['admin','editor','field','viewer'] as const
const ROLE_COLORS: Record<string, string> = {
  admin:  'text-err   bg-err/10   border-err/30',
  editor: 'text-acc   bg-acc/10   border-acc/30',
  field:  'text-warn  bg-warn/10  border-warn/30',
  viewer: 'text-acc2  bg-acc2/10  border-acc2/30',
}

interface Props {
  profile: Profile
  initialUsers: Profile[]
  initialLayers: Layer[]
}

export default function AdminPanel({ profile, initialUsers, initialLayers }: Props) {
  const supabase = createClient()
  const [tab, setTab]       = useState<'users'|'layers'|'stats'>('users')
  const [users, setUsers]   = useState<Profile[]>(initialUsers)
  const [layers]            = useState<Layer[]>(initialLayers)
  const [saving, setSaving] = useState<string | null>(null)

  // ---- Users ----
  const changeRole = async (userId: string, role: string) => {
    setSaving(userId)
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as Profile['role'] } : u))
    setSaving(null)
  }

  const TABS = [
    { key: 'users',  label: 'Përdoruesit',  icon: '👥' },
    { key: 'layers', label: 'Shtresat',      icon: '🗂️' },
    { key: 'stats',  label: 'Statistika',    icon: '📊' },
  ]

  return (
    <div className="flex flex-col h-screen bg-bg">
      <Navbar profile={profile} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-txt">Panel Administratori</h1>
            <p className="text-xs text-txt3 font-mono mt-1">
              Menaxhimi i sistemit GIS Ndërtim
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-s1 border border-b1 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${
                  tab === t.key
                    ? 'bg-acc text-white font-semibold'
                    : 'text-txt2 hover:text-txt hover:bg-s3'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ---- USERS TAB ---- */}
          {tab === 'users' && (
            <div className="bg-s1 border border-b1 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-b1 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-txt">
                  Përdoruesit ({users.length})
                </h2>
                <span className="text-xs text-txt3 font-mono">Roli ndryshohet direkt</span>
              </div>
              <div className="divide-y divide-b1">
                {users.map(u => (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-3 hover:bg-s2 transition-colors">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-b2 flex items-center justify-center shrink-0">
                      <span className="text-xs font-mono font-bold text-txt2">
                        {(u.full_name ?? u.email)[0].toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-txt truncate">{u.full_name ?? '—'}</p>
                      <p className="text-xs text-txt3 font-mono truncate">{u.email}</p>
                    </div>

                    {/* Self badge */}
                    {u.id === profile.id && (
                      <span className="text-[10px] font-mono text-txt3 bg-s3 border border-b2 px-2 py-0.5 rounded">
                        Unë
                      </span>
                    )}

                    {/* Role selector */}
                    <div className="relative">
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value)}
                        disabled={u.id === profile.id || saving === u.id}
                        className={`appearance-none text-xs font-mono px-3 py-1.5 rounded-lg border cursor-pointer outline-none transition-colors disabled:opacity-50 ${ROLE_COLORS[u.role]} bg-transparent`}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r} className="bg-s2 text-txt">{r}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date */}
                    <span className="text-[10px] text-txt3 font-mono shrink-0 hidden md:block">
                      {new Date(u.created_at).toLocaleDateString('sq-AL')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- LAYERS TAB ---- */}
          {tab === 'layers' && (
            <div className="bg-s1 border border-b1 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-b1">
                <h2 className="text-sm font-semibold text-txt">Shtresat ({layers.length})</h2>
              </div>
              <div className="divide-y divide-b1">
                {layers.map(l => (
                  <div key={l.id} className="flex items-center gap-4 px-5 py-3">
                    <div
                      className="w-4 h-4 rounded-sm shrink-0"
                      style={{ background: l.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-txt">{l.name}</p>
                      <p className="text-xs text-txt3 font-mono">{l.geom_type} · {(l.fields ?? []).length} fusha</p>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      l.visible ? 'text-acc bg-acc/10 border-acc/30' : 'text-txt3 bg-s3 border-b2'
                    }`}>
                      {l.visible ? 'Dukshme' : 'E fshehur'}
                    </span>
                    <span className="text-xs text-txt3 font-mono hidden md:block">
                      {new Date(l.created_at).toLocaleDateString('sq-AL')}
                    </span>
                  </div>
                ))}
                {layers.length === 0 && (
                  <p className="text-center text-xs text-txt3 font-mono py-8">
                    Nuk ka shtresa. Shko te Harta dhe shto.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ---- STATS TAB ---- */}
          {tab === 'stats' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard title="Gjithsej Përdorues" value={users.length} color="acc" />
              <StatCard title="Adminë" value={users.filter(u => u.role === 'admin').length} color="err" />
              <StatCard title="Editorë" value={users.filter(u => u.role === 'editor').length} color="acc" />
              <StatCard title="Inspektor (Field)" value={users.filter(u => u.role === 'field').length} color="warn" />
              <StatCard title="Shikues" value={users.filter(u => u.role === 'viewer').length} color="acc2" />
              <StatCard title="Shtresa GIS" value={layers.length} color="acc3" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    acc:  'text-acc  bg-acc/10  border-acc/30',
    err:  'text-err  bg-err/10  border-err/30',
    warn: 'text-warn bg-warn/10 border-warn/30',
    acc2: 'text-acc2 bg-acc2/10 border-acc2/30',
    acc3: 'text-acc3 bg-acc3/10 border-acc3/30',
  }
  return (
    <div className="bg-s1 border border-b1 rounded-2xl p-5">
      <p className="text-xs text-txt3 font-mono mb-2">{title}</p>
      <p className={`text-4xl font-bold font-mono ${colors[color].split(' ')[0]}`}>{value}</p>
    </div>
  )
}
