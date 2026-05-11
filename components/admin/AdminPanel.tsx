'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, Layer } from '@/lib/types'
import Navbar from '@/components/ui/Navbar'
import LayerPermissionsModal from './LayerPermissionsModal'

interface LogEntry {
  type: 'feature' | 'layer'
  id: string
  layerName: string
  action: 'created' | 'updated'
  user: string
  date: string
}

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
  const [tab, setTab]     = useState<'users'|'layers'|'stats'|'backup'|'logs'>('users')
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [layers]          = useState<Layer[]>(initialLayers)
  const [saving, setSaving] = useState<string | null>(null)

  // ---- Backup/Restore state ----
  const [backupLoading,  setBackupLoading]  = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreMsg,     setRestoreMsg]     = useState<{ok: boolean; text: string} | null>(null)

  // ---- Logs state ----
  const [logs,        setLogs]        = useState<LogEntry[] | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)

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

  // ---- Layer permissions modal ----
  const [permUser, setPermUser] = useState<Profile | null>(null)

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

  // ---- Backup ----
  const handleBackup = async () => {
    setBackupLoading(true)
    const { data: layersData } = await supabase.from('layers').select('*, fields:layer_fields(*)')
    const featuresMap: Record<string, unknown[]> = {}
    for (const layer of layersData ?? []) {
      let page = 0
      const all: unknown[] = []
      while (true) {
        const { data } = await supabase.from('features').select('id,layer_id,geometry,properties,created_by,created_at,updated_at')
          .eq('layer_id', layer.id).range(page * 1000, page * 1000 + 999)
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < 1000) break
        page++
      }
      featuresMap[layer.id] = all
    }
    const backup = { version: '1.0', date: new Date().toISOString(), layers: layersData ?? [], features: featuresMap }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `gis_backup_${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupLoading(false)
  }

  // ---- Restore ----
  const handleRestore = async (file: File) => {
    setRestoreMsg(null)
    let backup: { version: string; date?: string; layers: (Layer & { fields?: unknown[] })[]; features: Record<string, { id: string; layer_id: string; geometry: unknown; properties: unknown; created_by: string | null; created_at: string; updated_at: string }[]> }
    try {
      backup = JSON.parse(await file.text())
      if (!backup.layers || !backup.features) throw new Error()
    } catch {
      setRestoreMsg({ ok: false, text: 'Skedari nuk është i vlefshëm.' })
      return
    }
    if (!confirm(`Rimarro ${backup.layers.length} shtresa nga backup i datës ${backup.date?.slice(0,10)}?\n\nTë dhënat ekzistuese me të njëjtin ID do të mbishkruhen.`)) return
    setRestoreLoading(true)
    try {
      for (const layer of backup.layers) {
        const { fields, ...layerData } = layer
        await supabase.from('layers').upsert(layerData as Omit<Layer, 'fields'>)
        await supabase.from('layer_fields').delete().eq('layer_id', layer.id)
        if ((fields ?? []).length) await supabase.from('layer_fields').insert(fields as object[])
      }
      let totalFeatures = 0
      for (const feats of Object.values(backup.features)) {
        for (let i = 0; i < feats.length; i += 500) {
          await supabase.from('features').upsert(feats.slice(i, i + 500))
        }
        totalFeatures += feats.length
      }
      setRestoreMsg({ ok: true, text: `U rikthyen ${backup.layers.length} shtresa dhe ${totalFeatures} objekte.` })
    } catch {
      setRestoreMsg({ ok: false, text: 'Gabim gjatë rikthimit. Kontrollo konsolën.' })
    }
    setRestoreLoading(false)
  }

  // ---- Logs ----
  useEffect(() => {
    if (tab !== 'logs' || logs !== null) return
    setLogsLoading(true)
    Promise.all([
      supabase.from('features')
        .select('id, layer_id, created_at, updated_at, created_by, profile:profiles(full_name, email)')
        .order('updated_at', { ascending: false })
        .limit(200),
      supabase.from('layers')
        .select('id, name, created_at, updated_at, created_by')
        .order('updated_at', { ascending: false })
        .limit(30),
    ]).then(([{ data: feats }, { data: lyrs }]) => {
      const entries: LogEntry[] = [
        ...(feats ?? []).map(f => ({
          type: 'feature' as const,
          id: f.id,
          layerName: layers.find(l => l.id === f.layer_id)?.name ?? f.layer_id.slice(0,8),
          action: (f.created_at === f.updated_at ? 'created' : 'updated') as 'created' | 'updated',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          user: (f.profile as any)?.full_name ?? (f.profile as any)?.email ?? f.created_by?.slice(0,8) ?? '—',
          date: f.updated_at,
        })),
        ...(lyrs ?? []).map(l => ({
          type: 'layer' as const,
          id: l.id,
          layerName: l.name,
          action: (l.created_at === l.updated_at ? 'created' : 'updated') as 'created' | 'updated',
          user: '—',
          date: l.updated_at,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setLogs(entries)
      setLogsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const TABS = [
    { key: 'users',  label: 'Përdoruesit', icon: '👥' },
    { key: 'layers', label: 'Shtresat',     icon: '🗂️' },
    { key: 'stats',  label: 'Statistika',   icon: '📊' },
    { key: 'backup', label: 'Backup',       icon: '💾' },
    { key: 'logs',   label: 'Logs',         icon: '📋' },
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
                        <div className="flex gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
                          {/* Shield — layer permissions */}
                          <button
                            onClick={() => setPermUser(u)}
                            className="p-1.5 rounded text-txt3 hover:text-acc2 hover:bg-acc2/10 transition-colors"
                            title="Lejet e shtresave"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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
                      <span suppressHydrationWarning className="text-[10px] text-txt3 font-mono shrink-0 hidden md:block w-16 text-right">
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
                    <span suppressHydrationWarning className="text-xs text-txt3 font-mono hidden md:block">
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

          {/* ---- BACKUP TAB ---- */}
          {tab === 'backup' && (
            <div className="space-y-4">
              {/* Export */}
              <div className="bg-s1 border border-b1 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-acc/10 border border-acc/20 flex items-center justify-center shrink-0 text-lg">💾</div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-txt mb-1">Shkarko Backup</h3>
                    <p className="text-xs text-txt3 font-mono mb-4">Eksporton të gjitha shtresat, fushat dhe objektet si skedar JSON.</p>
                    <button
                      onClick={handleBackup}
                      disabled={backupLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-acc text-white rounded-lg text-xs font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                    >
                      {backupLoading
                        ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full"/> Duke eksportuar...</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Shkarko JSON</>
                      }
                    </button>
                  </div>
                </div>
              </div>

              {/* Restore */}
              <div className="bg-s1 border border-b1 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-warn/10 border border-warn/20 flex items-center justify-center shrink-0 text-lg">🔄</div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-txt mb-1">Rimarro nga Backup</h3>
                    <p className="text-xs text-txt3 font-mono mb-1">Ngarko një skedar JSON backup. Të dhënat ekzistuese me të njëjtin ID do të <span className="text-warn font-semibold">mbishkruhen</span>.</p>
                    <p className="text-[10px] text-txt3 font-mono mb-4 bg-warn/5 border border-warn/20 rounded px-2 py-1">⚠️ Kjo veprim mbishkruan të dhënat. Bëj një backup të ri para rikthimit.</p>
                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      restoreLoading ? 'opacity-50 pointer-events-none' : 'border-warn text-warn hover:bg-warn/10'
                    }`}>
                      {restoreLoading
                        ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-warn/30 border-t-warn rounded-full"/>Duke rikthyer...</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Zgjidh skedarin JSON</>
                      }
                      <input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { handleRestore(f); e.target.value = '' } }} />
                    </label>
                    {restoreMsg && (
                      <p className={`mt-3 text-xs font-mono px-3 py-2 rounded-lg border ${
                        restoreMsg.ok ? 'text-acc2 bg-acc2/10 border-acc2/30' : 'text-err bg-err/10 border-err/30'
                      }`}>
                        {restoreMsg.ok ? '✓ ' : '✗ '}{restoreMsg.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="bg-s1 border border-b1 rounded-2xl p-4">
                <p className="text-[10px] text-txt3 font-mono uppercase tracking-wider mb-2">Formati i Backup</p>
                <pre className="text-[10px] text-txt2 font-mono bg-s2 border border-b1 rounded-lg p-3 overflow-auto">{`{
  "version": "1.0",
  "date": "2026-01-01T00:00:00.000Z",
  "layers": [ { ...layer, "fields": [...] } ],
  "features": { "<layer_id>": [ ...features ] }
}`}</pre>
              </div>
            </div>
          )}

          {/* ---- LOGS TAB ---- */}
          {tab === 'logs' && (
            <div className="bg-s1 border border-b1 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-b1 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-txt">Aktiviteti i fundit</h2>
                <button
                  onClick={() => { setLogs(null); setLogsLoading(false) }}
                  className="flex items-center gap-1.5 text-xs font-mono text-txt2 hover:text-acc transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                  Rifresko
                </button>
              </div>
              {logsLoading && (
                <div className="flex items-center justify-center py-12 gap-2 text-xs text-txt3 font-mono">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-acc/30 border-t-acc rounded-full"/>
                  Duke ngarkuar aktivitetin...
                </div>
              )}
              {!logsLoading && logs !== null && logs.length === 0 && (
                <p className="text-center text-xs text-txt3 font-mono py-10">Nuk ka aktivitet të regjistruar.</p>
              )}
              {!logsLoading && logs !== null && logs.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-b1 text-left">
                        <th className="px-4 py-2 text-txt3 font-medium">Tipi</th>
                        <th className="px-4 py-2 text-txt3 font-medium">Shtresa</th>
                        <th className="px-4 py-2 text-txt3 font-medium">Veprimi</th>
                        <th className="px-4 py-2 text-txt3 font-medium">Përdoruesi</th>
                        <th className="px-4 py-2 text-txt3 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-b1">
                      {logs.map((entry, i) => (
                        <tr key={`${entry.id}-${i}`} className="hover:bg-s2 transition-colors">
                          <td className="px-4 py-2">
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${
                              entry.type === 'feature'
                                ? 'text-acc bg-acc/10 border-acc/20'
                                : 'text-acc3 bg-acc3/10 border-acc3/20'
                            }`}>
                              {entry.type === 'feature' ? 'Objekt' : 'Shtresë'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-txt max-w-[180px] truncate">{entry.layerName}</td>
                          <td className="px-4 py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              entry.action === 'created'
                                ? 'text-acc2 bg-acc2/10 border-acc2/20'
                                : 'text-warn bg-warn/10 border-warn/20'
                            }`}>
                              {entry.action === 'created' ? '+ Shtuar' : '✎ Ndryshuar'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-txt2 max-w-[140px] truncate">{entry.user}</td>
                          <td suppressHydrationWarning className="px-4 py-2 text-txt3 whitespace-nowrap">
                            {new Date(entry.date).toLocaleString('sq-AL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

      {/* Layer permissions modal */}
      {permUser && (
        <LayerPermissionsModal
          user={permUser}
          layers={layers}
          onClose={() => setPermUser(null)}
        />
      )}
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
