/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Turn off strict mode to prevent double-mounts of Leaflet maps during dev
  typescript: {
    ignoreBuildErrors: true, // Speeds up hackathon builds
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
}

module.exports = nextConfig
