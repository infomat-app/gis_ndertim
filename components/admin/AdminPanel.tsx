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
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', editor: 'Editor', field: 'Field', viewer: 'Viewer',
}

interface Props {
  profile: Profile
  initialUsers: Profile[]
  initialLayers: Layer[]
}

export default function AdminPanel({ profile, initialUsers, initialLayers }: Props) {
  const supabase = createClient()
  const [tab, setTab]     = useState<'users'|'layers'|'stats'>('users')
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [layers]          = useState<Layer[]>(initialLayers)
  const [saving, setSaving] = useState<string | null>(null)

  // ---- Add user form state ----
  const [showAdd,     setShowAdd]     = useState(false)
  const [addEmail,    setAddEmail]    = useState('')
  const [addName,     setAddName]     = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addRole,     setAddRole]     = useState<string>('viewer')
  const [addLoading,  setAddLoading]  = useState(false)
  const [addError,    setAddError]    = useState<string | null>(null)

  // ---- Inline edit state ----
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editName,   setEditName]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // ---- Change role ----
  const changeRole = async (userId: string, role: string) => {
    setSaving(userId)
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as Profile['role'] } : u))
    setSaving(null)
  }

  // ---- Add user ----
  const handleAddUser = async () => {
    if (!addEmail.trim() || !addName.trim() || !addPassword.trim()) {
      setAddError('Plotëso të gjitha fushat e detyrueshme.')
      return
    }
    setAddLoading(true)
    setAddError(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addEmail.trim(), password: addPassword, full_name: addName.trim(), role: addRole }),
    })
    const json = await res.json()
    if (!res.ok) {
      setAddError(json.error ?? 'Gabim i panjohur.')
    } else {
      setUsers(prev => [...prev, json.user])
      setShowAdd(false)
      setAddEmail(''); setAddName(''); setAddPassword(''); setAddRole('viewer')
    }
    setAddLoading(false)
  }

  // ---- Edit full_name ----
  const startEdit = (u: Profile) => { setEditingId(u.id); setEditName(u.full_name ?? '') }
  const cancelEdit = () => setEditingId(null)

  const handleEditSave = async (userId: string) => {
    if (!editName.trim()) return
    setEditSaving(true)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: editName.trim() }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, full_name: editName.trim() } : u))
      setEditingId(null)
    }
    setEditSaving(false)
  }

  // ---- Delete user ----
  const handleDelete = async (userId: string) => {
    if (!confirm('Je i sigurt? Kjo veprim është e pakthyeshme.')) return
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== userId))
    } else {
      const json = await res.json()
      alert(json.error ?? 'Gabim gjatë fshirjes.')
    }
  }

  const TABS = [
    { key: 'users',  label: 'Përdoruesit', icon: '👥' },
    { key: 'layers', label: 'Shtresat',     icon: '🗂️' },
    { key: 'stats',  label: 'Statistika',   icon: '📊' },
  ]

  return (
    <div className="flex flex-col h-screen bg-bg">
      <Navbar profile={profile} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-txt">Panel Administratori</h1>
            <p className="text-xs text-txt3 font-mono mt-1">Menaxhimi i sistemit GIS Ndërtim</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-s1 border border-b1 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${
                  tab === t.key ? 'bg-acc text-white font-semibold' : 'text-txt2 hover:text-txt hover:bg-s3'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ---- USERS TAB ---- */}
          {tab === 'users' && (
            <div className="bg-s1 border border-b1 rounded-2xl overflow-hidden">

              {/* Header */}
              <div className="px-5 py-4 border-b border-b1 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-txt">Përdoruesit ({users.length})</h2>
                <button
                  onClick={() => { setShowAdd(p => !p); setAddError(null) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    showAdd
                      ? 'bg-s3 text-txt2 border border-b2'
                      : 'bg-acc text-white hover:bg-[#1d4ed8]'
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    {showAdd
                      ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                      : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                    }
                  </svg>
                  {showAdd ? 'Mbyll' : 'Shto Përdorues'}
                </button>
              </div>

              {/* Add user form */}
              {showAdd && (
                <div className="px-5 py-4 border-b border-b1 bg-s2">
                  <p className="text-[10px] font-mono text-txt3 uppercase tracking-wider mb-3">Llogari e Re</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-txt2 font-mono mb-1">Email *</label>
                      <input
                        type="email"
                        value={addEmail}
                        onChange={e => setAddEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-txt2 font-mono mb-1">Emri i plotë *</label>
                      <input
                        value={addName}
                        onChange={e => setAddName(e.target.value)}
                        placeholder="Emri Mbiemri"
                        className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-txt2 font-mono mb-1">Fjalëkalimi *</label>
                      <input
                        type="password"
                        value={addPassword}
                        onChange={e => setAddPassword(e.target.value)}
                        placeholder="Min. 6 karaktere"
                        className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-txt2 font-mono mb-1">Roli</label>
                      <select
                        value={addRole}
                        onChange={e => setAddRole(e.target.value)}
                        className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </div>
                  </div>
                  {addError && (
                    <p className="text-xs text-err bg-err/10 border border-err/30 rounded-lg px-3 py-2 font-mono mb-3">{addError}</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setShowAdd(false); setAddError(null) }}
                      className="px-4 py-2 rounded-lg border border-b2 text-txt2 text-xs font-mono hover:bg-s3 transition-colors"
                    >
                      Anulo
                    </button>
                    <button
                      onClick={handleAddUser}
                      disabled={addLoading}
                      className="px-4 py-2 rounded-lg bg-acc text-white font-semibold text-xs hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                    >
                      {addLoading ? 'Duke krijuar...' : 'Krijo Llogarinë'}
                    </button>
                  </div>
                </div>
              )}

              {/* User rows */}
              <div className="divide-y divide-b1">
                {users.map(u => {
                  const isMe = u.id === profile.id
                  const isEditing = editingId === u.id
                  return (
                    <div key={u.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-s2 transition-colors">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-b2 flex items-center justify-center shrink-0">
                        <span className="text-xs font-mono font-bold text-txt2">
                          {(u.full_name ?? u.email)[0].toUpperCase()}
                        </span>
                      </div>

                      {/* Name / email */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleEditSave(u.id); if (e.key === 'Escape') cancelEdit() }}
                            autoFocus
                            className="w-full bg-bg border border-acc rounded-lg px-2 py-0.5 text-sm text-txt outline-none"
                          />
                        ) : (
                          <p className="text-sm text-txt truncate">{u.full_name ?? '—'}</p>
                        )}
                        <p className="text-xs text-txt3 font-mono truncate">{u.email}</p>
                      </div>

                      {/* Self badge */}
                      {isMe && (
                        <span className="text-[10px] font-mono text-txt3 bg-s3 border border-b2 px-2 py-0.5 rounded shrink-0">Unë</span>
                      )}

                      {/* Role selector */}
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value)}
                        disabled={isMe || saving === u.id}
                        className={`appearance-none text-xs font-mono px-2.5 py-1.5 rounded-lg border cursor-pointer outline-none transition-colors disabled:opacity-50 shrink-0 ${ROLE_COLORS[u.role]} bg-transparent`}
                      >
                        {ROLES.map(r => <option key={r} value={r} className="bg-s2 text-txt">{ROLE_LABELS[r]}</option>)}
                      </select>

                      {/* Edit / save-cancel buttons */}
                      {isEditing ? (
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleEditSave(u.id)}
                            disabled={editSaving}
                            className="p-1.5 rounded text-acc hover:bg-acc/10 transition-colors disabled:opacity-50"
                            title="Ruaj"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded text-txt3 hover:bg-s3 transition-colors"
                            title="Anulo"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Pencil — edit name */}
                          <button
                            onClick={() => startEdit(u)}
                            className="p-1.5 rounded text-txt3 hover:text-acc hover:bg-acc/10 transition-colors"
                            title="Edito emrin"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          {/* Trash — delete (not for self) */}
                          {!isMe && (
                            <button
                              onClick={() => handleDelete(u.id)}
                              className="p-1.5 rounded text-txt3 hover:text-err hover:bg-err/10 transition-colors"
                              title="Fshi llogarinë"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Date */}
                      <span className="text-[10px] text-txt3 font-mono shrink-0 hidden md:block w-16 text-right">
                        {new Date(u.created_at).toLocaleDateString('sq-AL')}
                      </span>
                    </div>
                  )
                })}
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
                    <div className="w-4 h-4 rounded-sm shrink-0" style={{ background: l.color }} />
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
    acc:  'text-acc',
    err:  'text-err',
    warn: 'text-warn',
    acc2: 'text-acc2',
    acc3: 'text-acc3',
  }
  return (
    <div className="bg-s1 border border-b1 rounded-2xl p-5">
      <p className="text-xs text-txt3 font-mono mb-2">{title}</p>
      <p className={`text-4xl font-bold font-mono ${colors[color]}`}>{value}</p>
    </div>
  )
}
