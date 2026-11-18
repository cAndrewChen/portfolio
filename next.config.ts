import type { NextConfig } from 'next'

// hide the round Next.js dev-tools badge that sits in the bottom-left corner during development
// output 'export' builds a static site into out/ for GitHub Pages, which serves it under /<repo name>/ (set by the deploy workflow)
const config: NextConfig = { devIndicators: false, output: 'export', basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '' }

export default config
