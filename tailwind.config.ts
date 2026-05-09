import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:   '#060b14',
        s1:   '#0a1628',
        s2:   '#0e1d35',
        s3:   '#131f3a',
        s4:   '#172647',
        b1:   '#18284a',
        b2:   '#1f3460',
        b3:   '#28437a',
        acc:  '#4da6ff',
        acc2: '#7ec8ff',
        acc3: '#a78bfa',
        warn: '#ffaa2e',
        err:  '#ff4d6d',
        txt:  '#dce6f5',
        txt2: '#7a9fc4',
        txt3: '#3a5a80',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
