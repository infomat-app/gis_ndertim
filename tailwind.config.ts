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
        bg:   '#eef3ff',
        s1:   '#ffffff',
        s2:   '#f4f7ff',
        s3:   '#e8efff',
        s4:   '#dce8ff',
        b1:   '#d4e2ff',
        b2:   '#b0c8ff',
        b3:   '#88aaff',
        acc:  '#2563eb',
        acc2: '#3b82f6',
        acc3: '#7c3aed',
        warn: '#d97706',
        err:  '#dc2626',
        txt:  '#0f1e3c',
        txt2: '#3d5a8a',
        txt3: '#7a96c0',
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
