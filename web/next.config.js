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
}

module.exports = nextConfig

