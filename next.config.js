/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["youtube-dl-exec"],
    outputFileTracingIncludes: {
      "/api/transcript": ["./node_modules/youtube-dl-exec/bin/yt-dlp"],
    },
  },
};

module.exports = nextConfig;
