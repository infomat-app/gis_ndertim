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
        bg:   '#07090f',
        s1:   '#0d1119',
        s2:   '#121820',
        s3:   '#18202e',
        s4:   '#1e2838',
        b1:   '#1c2740',
        b2:   '#253352',
        b3:   '#2e4068',
        acc:  '#05d9a0',
        acc2: '#2d8bff',
        acc3: '#9b5fff',
        warn: '#ffaa2e',
        err:  '#ff4d6d',
        txt:  '#dce6f5',
        txt2: '#8da0bb',
        txt3: '#3d5275',
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
