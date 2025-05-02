/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'oaidalleapiprodscus.blob.core.windows.net', 
      'cdn.openai.com', 
      'fal.ai',
      'storage.googleapis.com',
      'replicate.delivery'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.fal.ai'
      }
    ]
  },
  trailingSlash: false
};

module.exports = nextConfig;