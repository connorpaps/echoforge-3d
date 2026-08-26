import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] }
  },
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support for Rapier3D
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true
    };

    // Transformers.js: avoid bundling Node-only backends into the client bundle
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        sharp: false,
        'onnxruntime-node': false
      };
    }

    // Prevent server-side compilation of browser workers
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false
      };
    }

    return config;
  }
};

export default nextConfig;
