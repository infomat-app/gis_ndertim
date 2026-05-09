'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [mode, setMode]         = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (err) { setError(err.message); setLoading(false); return }
    }

    router.push('/map')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-acc/20 border border-acc/40 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-txt">GIS Ndërtim</h1>
          <p className="text-sm text-txt2 font-mono mt-1">Sistem menaxhimi gjeografik</p>
        </div>

        <div className="bg-s1 border border-b1 rounded-2xl p-8">
          {/* Mode toggle */}
          <div className="flex bg-bg rounded-lg p-1 mb-6">
            {(['login','register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2 rounded-md text-sm font-mono transition-all ${
                  mode === m
                    ? 'bg-acc text-white font-semibold'
                    : 'text-txt2 hover:text-txt'
                }`}
              >
                {m === 'login' ? 'Hyrje' : 'Regjistrim'}
              </button>
            ))}
          </div>

          <form onSubmit={handle} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-txt2 font-mono mb-1.5">Emri i plotë</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="w-full bg-bg border border-b1 rounded-lg px-3 py-2.5 text-sm text-txt outline-none focus:border-acc transition-colors"
                  placeholder="Emri Mbiemri"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-txt2 font-mono mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-bg border border-b1 rounded-lg px-3 py-2.5 text-sm text-txt outline-none focus:border-acc transition-colors"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-txt2 font-mono mb-1.5">Fjalëkalimi</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-bg border border-b1 rounded-lg px-3 py-2.5 text-sm text-txt outline-none focus:border-acc transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs text-err bg-err/10 border border-err/30 rounded-lg px-3 py-2 font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-acc text-white font-semibold text-sm rounded-lg py-3 hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Duke u procesuar...' : mode === 'login' ? 'Hyr' : 'Regjistrohu'}
            </button>
          </form>

          <p className="text-xs text-txt3 text-center mt-6 font-mono">
            Të drejtat e aksesit i jep Administratori
          </p>
        </div>
      </div>
    </div>
  )
}
