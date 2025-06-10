'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Shield, Users, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TermsOfServicePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <Card className="bg-card/90 border-border/50">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Terms of Service</CardTitle>
              <p className="text-muted-foreground">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </CardHeader>
          </Card>
        </div>

        {/* Terms Content */}
        <Card className="bg-card/90 border-border/50">
          <CardContent className="p-8 space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-primary" />
                Agreement to Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using CrossAnd Plans ("Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <Separator />

            {/* Service Description */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Service Description</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                CrossAnd Plans is a collaborative planning platform that helps users create, organize, and share plans for various activities. Our service includes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Plan creation and management tools</li>
                <li>Collaborative planning features</li>
                <li>Social interaction and sharing capabilities</li>
                <li>Personalized recommendations</li>
                <li>User profile and preference management</li>
              </ul>
            </section>

            <Separator />

            {/* User Accounts */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-primary" />
                User Accounts
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  To access certain features of our Service, you must register for an account. You agree to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate, current, and complete information during registration</li>
                  <li>Maintain and update your account information</li>
                  <li>Keep your password secure and confidential</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized use</li>
                </ul>
              </div>
            </section>

            <Separator />

            {/* Acceptable Use */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-primary" />
                Acceptable Use Policy
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  You agree not to use the Service to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe on intellectual property rights</li>
                  <li>Transmit harmful, offensive, or inappropriate content</li>
                  <li>Harass, abuse, or harm other users</li>
                  <li>Distribute spam, malware, or malicious code</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Use the service for commercial purposes without permission</li>
                </ul>
              </div>
            </section>

            <Separator />

            {/* Privacy and Data */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Privacy and Data Protection</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference. By using our Service, you consent to the collection and use of your information as outlined in our Privacy Policy.
              </p>
            </section>

            <Separator />

            {/* Content and Intellectual Property */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Content and Intellectual Property</h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  You retain ownership of content you create and share through our Service. However, by posting content, you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content in connection with the Service.
                </p>
                <p className="leading-relaxed">
                  All Service content, features, and functionality are owned by CrossAnd Plans and are protected by copyright, trademark, and other intellectual property laws.
                </p>
              </div>
            </section>

            <Separator />

            {/* Disclaimers */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Disclaimers and Limitations</h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  The Service is provided "as is" without warranties of any kind. We do not guarantee that the Service will be uninterrupted, secure, or error-free.
                </p>
                <p className="leading-relaxed">
                  To the fullest extent permitted by law, CrossAnd Plans shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.
                </p>
              </div>
            </section>

            <Separator />

            {/* Termination */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your account and access to the Service at our sole discretion, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
              </p>
            </section>

            <Separator />

            {/* Changes to Terms */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of significant changes via email or through the Service. Your continued use of the Service after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <Separator />

            {/* Contact Information */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm">
                  <strong>Email:</strong> legal@crossandplans.com<br />
                  <strong>Address:</strong> CrossAnd Plans Legal Department<br />
                  123 Planning Street, Suite 100<br />
                  Planning City, PC 12345
                </p>
              </div>
            </section>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link href="/privacy" className="text-primary hover:underline mr-4">
            Privacy Policy
          </Link>
          <Link href="/" className="text-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}