import type { NextConfig } from 'next';

// Every browser call goes to /api/* on the frontend's own domain and is forwarded
// to FastAPI. The session cookie therefore stays first-party and no CORS is needed.
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cloudscape-design/components', '@cloudscape-design/component-toolkit'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }];
  },
  async redirects() {
    return [
      { source: '/', destination: '/route53/v2/hostedzones', permanent: false },
      { source: '/route53', destination: '/route53/v2/home', permanent: false },
      { source: '/route53/v2', destination: '/route53/v2/home', permanent: false },
    ];
  },
};

export default nextConfig;
