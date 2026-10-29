/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright chứa binary, không để Next đóng gói vào bundle
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
