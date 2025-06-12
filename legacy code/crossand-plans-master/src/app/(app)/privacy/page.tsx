'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Eye, Lock, Database, Users, Globe } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
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
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Privacy Policy</CardTitle>
              <p className="text-muted-foreground">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </CardHeader>
          </Card>
        </div>

        {/* Privacy Content */}
        <Card className="bg-card/90 border-border/50">
          <CardContent className="p-8 space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Eye className="h-5 w-5 mr-2 text-primary" />
                Our Commitment to Privacy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                At CrossAnd Plans, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our planning platform.
              </p>
            </section>

            <Separator />

            {/* Information We Collect */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Database className="h-5 w-5 mr-2 text-primary" />
                Information We Collect
              </h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Personal Information</h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We collect information you provide directly to us, including:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                    <li>Name, username, and email address</li>
                    <li>Profile information (bio, preferences, location)</li>
                    <li>Contact information (phone number, address)</li>
                    <li>Dietary restrictions and health preferences</li>
                    <li>Activity preferences and limitations</li>
                    <li>Social preferences and availability</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Usage Information</h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We automatically collect certain information about your use of our Service:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                    <li>Device information (IP address, browser type, operating system)</li>
                    <li>Usage patterns and feature interactions</li>
                    <li>Plans created, viewed, and shared</li>
                    <li>Search queries and preferences</li>
                    <li>Communication and collaboration activities</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Cookies and Tracking</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We use cookies and similar tracking technologies to enhance your experience, analyze usage patterns, and provide personalized content. You can control cookie settings through your browser preferences.
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            {/* How We Use Information */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-primary" />
                How We Use Your Information
              </h2>
              
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Provide, maintain, and improve our Service</li>
                <li>Create and manage your account</li>
                <li>Personalize your experience and recommendations</li>
                <li>Facilitate plan creation and collaboration</li>
                <li>Send important notifications and updates</li>
                <li>Respond to your inquiries and provide support</li>
                <li>Analyze usage patterns to improve our platform</li>
                <li>Ensure security and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <Separator />

            {/* Information Sharing */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Globe className="h-5 w-5 mr-2 text-primary" />
                Information Sharing and Disclosure
              </h2>
              
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-foreground mb-2">With Other Users</h4>
                    <p className="leading-relaxed">
                      When you create or participate in collaborative plans, certain profile information may be visible to other participants as necessary for the planning process.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Service Providers</h4>
                    <p className="leading-relaxed">
                      We may share information with trusted third-party service providers who assist us in operating our platform, such as hosting, analytics, and customer support services.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Legal Requirements</h4>
                    <p className="leading-relaxed">
                      We may disclose information when required by law, court order, or to protect our rights, property, or safety, or that of our users or others.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Business Transfers</h4>
                    <p className="leading-relaxed">
                      In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the business transaction.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Data Security */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Lock className="h-5 w-5 mr-2 text-primary" />
                Data Security
              </h2>
              
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security assessments and updates</li>
                  <li>Access controls and authentication requirements</li>
                  <li>Secure data storage and backup procedures</li>
                  <li>Employee training on data protection practices</li>
                </ul>
                <p className="leading-relaxed">
                  However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
                </p>
              </div>
            </section>

            <Separator />

            {/* Your Rights and Choices */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Your Rights and Choices</h2>
              
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  You have certain rights regarding your personal information:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                  <li><strong>Correction:</strong> Update or correct inaccurate personal information</li>
                  <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal requirements)</li>
                  <li><strong>Portability:</strong> Request a copy of your data in a structured, machine-readable format</li>
                  <li><strong>Restriction:</strong> Request limitation of processing of your personal information</li>
                  <li><strong>Objection:</strong> Object to certain types of processing</li>
                </ul>
                <p className="leading-relaxed">
                  To exercise these rights, please contact us using the information provided below. We will respond to your request within a reasonable timeframe and in accordance with applicable law.
                </p>
              </div>
            </section>

            <Separator />

            {/* Data Retention */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. When you delete your account, we will delete or anonymize your personal information, except where retention is required by law.
              </p>
            </section>

            <Separator />

            {/* Children's Privacy */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
              </p>
            </section>

            <Separator />

            {/* International Transfers */}
            <section>
              <h2 className="text-xl font-semibold mb-4">International Data Transfers</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and processed in countries other than your country of residence. We ensure that such transfers are conducted in accordance with applicable data protection laws and with appropriate safeguards in place.
              </p>
            </section>

            <Separator />

            {/* Changes to Privacy Policy */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Changes to This Privacy Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically.
              </p>
            </section>

            <Separator />

            {/* Contact Information */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm">
                  <strong>Email:</strong> privacy@crossandplans.com<br />
                  <strong>Data Protection Officer:</strong> dpo@crossandplans.com<br />
                  <strong>Address:</strong> CrossAnd Plans Privacy Team<br />
                  123 Planning Street, Suite 100<br />
                  Planning City, PC 12345
                </p>
              </div>
            </section>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link href="/terms" className="text-primary hover:underline mr-4">
            Terms of Service
          </Link>
          <Link href="/" className="text-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}