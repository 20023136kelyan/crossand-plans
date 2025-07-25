import type {NextConfig} from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  // You can add runtimeCaching or other options here if needed
});

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    // Explicitly expose the GIPHY API key to the client
    NEXT_PUBLIC_GIPHY_API_KEY: process.env.NEXT_PUBLIC_GIPHY_API_KEY,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: 10 * 6000 * 6000, // 10MB
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // For Google Sign-In avatars
        port: '',
        pathname: '/**',
      },
      { 
        protocol: 'https',
        hostname: 'maps.googleapis.com', // For Google Static Maps & Places Photos
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media*.giphy.com', // For GIPHY media
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.giphy.com', // For GIPHY media
        port: '',
        pathname: '/**',
      },
      { 
        protocol: 'https',
        hostname: 'storage.googleapis.com', // For Firebase Storage (default domain)
        port: '',
        // IMPORTANT: Replace palplanai.appspot.com with YOUR Firebase Storage bucket name if it's different
        // Ensure the pathname matches the bucket name used in your Storage URLs.
        // Example: /your-project-id.appspot.com/**
        pathname: `/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'palplanai.appspot.com'}/**`, 
      },
       { 
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com', // For Firebase Storage (alternative domain, often for signed URLs)
        port: '',
        // Example: /v0/b/your-project-id.appspot.com/o/**
        pathname: `/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'palplanai.appspot.com'}/o/**`, 
      }
    ],
  },
};

module.exports = withPWA(nextConfig);

    