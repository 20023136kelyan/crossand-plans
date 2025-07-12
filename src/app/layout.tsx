
import type { Metadata, Viewport } from 'next';
import { Geist, Redressed } from 'next/font/google'; // Using Geist Sans as a clean, readable sans-serif font
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/AuthContext'; // Import AuthProvider
import { SettingsProvider } from '@/context/SettingsContext'; // Import SettingsProvider
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeColorManager } from '@/components/theme-color-manager';
import Script from 'next/script';
import { firestoreAdmin } from '@/lib/firebaseAdmin';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const redressed = Redressed({
  variable: '--font-redressed',
  subsets: ['latin'],
  weight: '400',
});

// Dynamic metadata generation
async function generateMetadata(): Promise<Metadata> {
  try {
    if (!firestoreAdmin) {
      throw new Error('Firestore admin not available');
    }
    
    const settingsDoc = await firestoreAdmin
      .collection('settings')
      .doc('application')
      .get();

    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const siteName = settings?.siteName || 'Crossand';
    const siteDescription = settings?.siteDescription || 'Sweeten your social planning with Crossand';

    return {
      title: {
        default: siteName,
        template: `%s | ${siteName}`,
      },
      description: siteDescription,
      keywords: ['social planning', 'events', 'coordination', 'friends', 'activities'],
      authors: [{ name: siteName }],
      creator: siteName,
      publisher: siteName,
      formatDetection: {
        email: false,
        address: false,
        telephone: false,
      },
      metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
      openGraph: {
        title: siteName,
        description: siteDescription,
        type: 'website',
        locale: 'en_US',
        siteName: siteName,
      },
      twitter: {
        card: 'summary_large_image',
        title: siteName,
        description: siteDescription,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    // Fallback metadata
    return {
      title: 'Macaroom',
      description: 'Sweeten your social planning with Macaroom',
    };
  }
}

export const metadata: Metadata = await generateMetadata();

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Optional: good for preventing accidental zoom on mobile
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/images/icon-192x192.png" />
      </head>
      <body 
        className={`${geistSans.variable} ${redressed.variable} font-sans antialiased h-full flex flex-col`}
        suppressHydrationWarning={true}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <SettingsProvider>
            <AuthProvider> {/* Wrap children with AuthProvider */}
              <ThemeColorManager />
              {children}
              <Toaster />
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
