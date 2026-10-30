import type { NextConfig } from 'next'
import path from 'node:path'

const requestedBuildCpus = Number(process.env.NEXT_BUILD_CPUS || 1)
const buildCpus = Number.isInteger(requestedBuildCpus) && requestedBuildCpus > 0
  ? Math.min(requestedBuildCpus, 4) : 1

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { cpus: buildCpus },
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{
      source: '/fonts/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }]
  },
  webpack(config) {
    // linkedom's optional canvas implementation is unused by HTML sanitization.
    config.resolve.alias = { ...config.resolve.alias, canvas: false }
    return config
  },
}

export default nextConfig
