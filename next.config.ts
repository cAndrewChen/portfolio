import type { NextConfig } from 'next'

// hide the round Next.js dev-tools badge that sits in the bottom-left corner during development
// output 'export' builds a static site into out/ for GitHub Pages
const config: NextConfig = { devIndicators: false, output: 'export' }

export default config
