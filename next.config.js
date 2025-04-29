/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
  trailingSlash: false,
  async redirects() {
    return [
      {
        source: '/api/webhooks/clerk',
        destination: '/api/webhooks/clerk',
        permanent: true,
      },
    ]
  },
};

module.exports = nextConfig; 