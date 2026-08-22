/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    authInterrupts: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "eaassets-a.akamaihd.net" },
      { protocol: "https", hostname: "ratings-images-prod.pulse.ea.com" },
      { protocol: "https", hostname: "cdn.sofifa.net" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "selimdoyranli.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" }
    ],
  },
};

export default nextConfig;
