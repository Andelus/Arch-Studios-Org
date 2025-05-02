/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['oaidalleapiprodscus.blob.core.windows.net', 'cdn.openai.com', 'fal.ai'],
  },
  trailingSlash: false
};

module.exports = nextConfig;