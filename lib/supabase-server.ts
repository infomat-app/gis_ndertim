import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options?: object }[]) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any))
          } catch {}
        },
      },
    }
  )
}
