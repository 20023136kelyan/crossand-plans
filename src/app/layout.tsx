
import type { Metadata } from 'next';
import { Geist } from 'next/font/google'; // Using Geist Sans as a clean, readable sans-serif font
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/AuthContext'; // Import AuthProvider
import Script from 'next/script';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Macaroom',
  description: 'Sweeten your social planning with Macaroom',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1, // Optional: good for preventing accidental zoom on mobile
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geistSans.variable} font-sans antialiased h-full flex flex-col`}>
        <AuthProvider> {/* Wrap children with AuthProvider */}
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
