import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pin Turbopack to this project. The repo lives under OneDrive, so Next walks
// up the tree and finds unrelated package-lock.json files in the home directory
// ("Next.js ignored package-lock.json in C:\Users\<user>").
const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root },
};

export default nextConfig;