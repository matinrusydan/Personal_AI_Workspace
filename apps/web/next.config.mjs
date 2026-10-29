/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@paw/ui', '@paw/contracts', '@paw/config'],
};

export default nextConfig;
