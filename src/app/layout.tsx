import type { Metadata, Viewport } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarRail } from "@/components/ui/sidebar";
import { MainNavigation } from "@/components/main-navigation";
import { Logo } from "@/components/logo";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Settings, UserCircle } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MOCK_USER_ID } from "@/types"; // Assuming MOCK_USER_ID is here for placeholder
import { getUserProfile } from "@/lib/actions/user"; // To fetch user data

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "PlanPal - Effortless Group Event Planning",
  description: "Organize your group events with AI-powered suggestions, seamless scheduling, and expense management. PlanPal makes it easy to coordinate with friends and create memorable experiences.",
  keywords: ["event planning", "group events", "AI suggestions", "scheduling", "expense management", "PlanPal"],
  applicationName: "PlanPal",
  authors: [{ name: "PlanPal Team" }],
  creator: "PlanPal Team",
  publisher: "PlanPal",
  // Open Graph
  openGraph: {
    type: "website",
    url: "https://your-planpal-url.com", // Replace with your actual URL
    title: "PlanPal - Effortless Group Event Planning",
    description: "Organize your group events with AI-powered suggestions, seamless scheduling, and expense management.",
    siteName: "PlanPal",
    images: [{
      url: "https://your-planpal-url.com/og-image.png", // Replace with your actual OG image URL
    }],
  },
  // Twitter Card
  twitter: {
    card: "summary_large_image",
    // site: "@planpalapp", // Replace with your Twitter handle if you have one
    // creator: "@planpalteam", // Replace with your team's Twitter handle
    title: "PlanPal - Effortless Group Event Planning",
    description: "Organize your group events with AI-powered suggestions, seamless scheduling, and expense management.",
    // images: ["https://your-planpal-url.com/twitter-image.png"], // Replace with your Twitter image URL
  },
  // Icons
  icons: {
    icon: "/favicon.ico", // Ensure you have a favicon.ico in your public folder
    // apple: "/apple-touch-icon.png", // For Apple touch icon
  },
  // Manifest
  // manifest: "/site.webmanifest", // If you have a web app manifest
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch user profile for avatar in header. This is a server component.
  const userProfile = await getUserProfile(MOCK_USER_ID);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="Content-Security-Policy" content="geolocation 'self' https://maps.googleapis.com" />
      </head>
      <body
        suppressHydrationWarning // Added to mitigate hydration errors from browser extensions
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <SidebarProvider defaultOpen>
          <Sidebar>
            <SidebarHeader>
              <div className="p-2 flex justify-between items-center">
                <Logo />
                <SidebarTrigger className="md:hidden" />
              </div>
            </SidebarHeader>
            <SidebarContent>
              <MainNavigation />
            </SidebarContent>
            <SidebarFooter>
               <div className="flex items-center gap-2 p-2 border-t border-sidebar-border">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userProfile?.avatarUrl || undefined} alt={userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : "User"} data-ai-hint="user avatar"/>
                  <AvatarFallback>
                    {userProfile ? `${userProfile.firstName?.charAt(0)}${userProfile.lastName?.charAt(0)}` : <UserCircle />}
                  </AvatarFallback>
                </Avatar>
                {!userProfile && <span className="text-sm text-sidebar-foreground">User Profile</span>}
                {userProfile && (
                  <div className="text-sm text-sidebar-foreground overflow-hidden">
                    <p className="font-semibold truncate">{`${userProfile.firstName} ${userProfile.lastName}`}</p>
                  </div>
                )}
              </div>
               <Button variant="ghost" className="justify-start w-full hidden">
                <Settings /> Settings
              </Button>
            </SidebarFooter>
          </Sidebar>
          <SidebarRail />
          <SidebarInset>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
