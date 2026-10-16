/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Required for Docker deployment
  
  // Skip type checking during build for MVP speed
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Skip ESLint during build for MVP speed
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Optional same-origin proxies (e.g. for preview environments where only the web port is exposed).
  // Set NEXT_PUBLIC_SUPABASE_URL=/supabase together with SUPABASE_PROXY_TARGET, and
  // NEXT_PUBLIC_HOCUSPOCUS_URL=/hocuspocus together with HOCUSPOCUS_PROXY_TARGET, etc.
  async rewrites() {
    const proxies = [
      ['/supabase', process.env.SUPABASE_PROXY_TARGET],
      ['/hocuspocus', process.env.HOCUSPOCUS_PROXY_TARGET],
      ['/y-webrtc', process.env.Y_WEBRTC_SIGNALING_PROXY_TARGET],
    ]
    return proxies
      .filter(([, target]) => target)
      .flatMap(([source, target]) => [
        { source, destination: target },
        { source: `${source}/:path*`, destination: `${target}/:path*` },
      ])
  },
}

module.exports = nextConfig
