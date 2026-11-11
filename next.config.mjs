/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module, so keep it out of the bundler
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;