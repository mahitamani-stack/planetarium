/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
  // Proxy R2 assets through our own origin so the browser sees a same-origin
  // request — R2's public r2.dev subdomain doesn't honor bucket CORS policy
  // (only a custom domain does), and WebGL textures need CORS-clear images.
  async rewrites() {
    return [
      {
        source: "/cdn/:path*",
        destination: "https://pub-86eb415eb15143d09ccacc63f0e840f4.r2.dev/:path*",
      },
    ];
  },
};

export default nextConfig;
