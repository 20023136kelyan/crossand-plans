import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: 10 * 6000 * 6000, // 10MB
    },
  },
  images: {
    domains: ['localhost'],
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

export default nextConfig;

    