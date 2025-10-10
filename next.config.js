/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@modelcontextprotocol/sdk"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.extensionAlias = {
        ".js": [".ts", ".tsx", ".js", ".jsx"],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
