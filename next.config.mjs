/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@react-three/drei"],
  },
  // Links viejos /b/<slug>/... → URL corta /<slug>/... (permanente)
  async redirects() {
    return [{ source: "/b/:path*", destination: "/:path*", permanent: true }];
  },
};
