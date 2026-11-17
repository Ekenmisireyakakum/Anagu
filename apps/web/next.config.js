const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {(phase: string) => import('next').NextConfig} */
module.exports = (phase) => ({
  output: process.env.VERCEL ? undefined : 'standalone',
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
});
