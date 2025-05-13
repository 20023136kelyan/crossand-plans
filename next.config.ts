
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com', // Added for potential static map images
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.forestry.gov.my', 
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Common for Google Places photos
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.google.com', // Added for Google Maps images
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
