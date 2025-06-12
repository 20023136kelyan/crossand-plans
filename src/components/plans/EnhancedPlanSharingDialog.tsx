'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Share2, 
  Copy, 
  QrCode, 
  Mail, 
  MessageSquare, 
  Facebook, 
  Twitter, 
  Instagram, 
  Link2, 
  Download, 
  Eye, 
  Users, 
  Globe, 
  Lock,
  CheckCircle,
  ExternalLink,
  Calendar,
  MapPin
} from 'lucide-react';
import { Plan } from '@/types/plan';
import { User } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

interface EnhancedPlanSharingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  currentUser: User | null;
  isHost: boolean;
  onShareToFeed: () => Promise<void>;
  onShareWithFriends: (friendIds: string[], message?: string) => Promise<void>;
  onUpdateShareSettings: (settings: ShareSettings) => Promise<void>;
}

interface ShareSettings {
  isPublic: boolean;
  allowCopying: boolean;
  allowComments: boolean;
  requireApproval: boolean;
  shareableLink: boolean;
  embedEnabled: boolean;
}

interface SocialPlatform {
  name: string;
  icon: React.ReactNode;
  color: string;
  shareUrl: (url: string, text: string) => string;
}

const socialPlatforms: SocialPlatform[] = [
  {
    name: 'Facebook',
    icon: <Facebook className="h-4 w-4" />,
    color: 'bg-blue-600',
    shareUrl: (url, text) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`
  },
  {
    name: 'Twitter',
    icon: <Twitter className="h-4 w-4" />,
    color: 'bg-sky-500',
    shareUrl: (url, text) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  },
  {
    name: 'Instagram',
    icon: <Instagram className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    shareUrl: (url, text) => `https://www.instagram.com/` // Instagram doesn't support direct sharing
  }
];

export function EnhancedPlanSharingDialog({
  open,
  onOpenChange,
  plan,
  currentUser,
  isHost,
  onShareToFeed,
  onShareWithFriends,
  onUpdateShareSettings
}: EnhancedPlanSharingDialogProps) {
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    isPublic: plan.status === 'published',
    allowCopying: true,
    allowComments: true,
    requireApproval: false,
    shareableLink: true,
    embedEnabled: false
  });
  const [customMessage, setCustomMessage] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const qrRef = useRef<HTMLDivElement>(null);

  const planUrl = `${window.location.origin}/plans/${plan.id}`;
  const shareText = `Check out this amazing plan: ${plan.name} in ${plan.city}`;
  const embedCode = `<iframe src="${planUrl}/embed" width="100%" height="600" frameborder="0"></iframe>`;

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [type]: true }));
      toast.success('Copied to clipboard!');
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [type]: false }));
      }, 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSocialShare = (platform: SocialPlatform) => {
    if (platform.name === 'Instagram') {
      // Instagram doesn't support direct URL sharing, so copy the link
      handleCopy(planUrl, 'instagram');
      toast.info('Link copied! Paste it in your Instagram story or bio.');
      return;
    }
    
    const shareUrl = platform.shareUrl(planUrl, shareText);
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const handleShareToFeed = async () => {
    setIsLoading(true);
    try {
      await onShareToFeed();
      toast.success('Plan shared to your feed!');
    } catch (error) {
      toast.error('Failed to share to feed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareWithFriends = async () => {
    if (selectedFriends.length === 0) {
      toast.error('Please select at least one friend');
      return;
    }

    setIsLoading(true);
    try {
      await onShareWithFriends(selectedFriends, customMessage.trim() || undefined);
      toast.success(`Plan shared with ${selectedFriends.length} friends!`);
      setSelectedFriends([]);
      setCustomMessage('');
    } catch (error) {
      toast.error('Failed to share with friends');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    setIsLoading(true);
    try {
      await onUpdateShareSettings(shareSettings);
      toast.success('Share settings updated!');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadQRCode = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${plan.name}-qr-code.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Plan
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="share" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="share">Share</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
            <TabsTrigger value="settings" disabled={!isHost}>Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-6">
            {/* Plan Preview */}
            <div className="p-4 rounded-lg border bg-gray-50">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {plan.city}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {plan.itinerary.length} stops
                    </span>
                    <Badge variant={plan.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                      {plan.status === 'published' ? (
                        <><Globe className="h-3 w-3 mr-1" />Public</>
                      ) : (
                        <><Lock className="h-3 w-3 mr-1" />Private</>
                      )}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Share Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Share Link */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Share Link</Label>
                <div className="flex gap-2">
                  <Input value={planUrl} readOnly className="flex-1" />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleCopy(planUrl, 'link')}
                  >
                    {copiedStates.link ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(planUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* QR Code */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">QR Code</Label>
                <div className="flex items-center gap-3">
                  <div ref={qrRef} className="p-2 bg-white rounded border">
                    <QRCodeSVG value={planUrl} size={80} />
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" onClick={downloadQRCode}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <p className="text-xs text-gray-500">
                      Scan to view plan
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Share to Feed */}
            {currentUser && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Share to Your Feed</Label>
                <div className="flex items-center gap-3">
                  <Button onClick={handleShareToFeed} disabled={isLoading}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share to Feed
                  </Button>
                  <p className="text-sm text-gray-500">
                    Share this plan with all your followers
                  </p>
                </div>
              </div>
            )}

            {/* Share with Friends */}
            {currentUser && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Share with Friends</Label>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Add a personal message (optional)..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={handleShareWithFriends} disabled={isLoading || selectedFriends.length === 0}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Share with {selectedFriends.length} Friends
                    </Button>
                    <Button variant="outline" size="sm">
                      <Users className="h-4 w-4 mr-1" />
                      Select Friends
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Share on Social Media</Label>
                <p className="text-sm text-gray-500 mt-1">
                  Share your plan on your favorite social platforms
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {socialPlatforms.map((platform) => (
                  <Button
                    key={platform.name}
                    variant="outline"
                    className="h-16 flex-col gap-2"
                    onClick={() => handleSocialShare(platform)}
                  >
                    <div className={`p-2 rounded ${platform.color} text-white`}>
                      {platform.icon}
                    </div>
                    <span className="text-sm">{platform.name}</span>
                  </Button>
                ))}
              </div>

              <div className="p-4 rounded-lg border bg-blue-50">
                <h4 className="font-medium text-blue-900 mb-2">Share Text Preview</h4>
                <p className="text-sm text-blue-800">{shareText}</p>
                <p className="text-xs text-blue-600 mt-1">{planUrl}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Embed Code</Label>
                <p className="text-sm text-gray-500 mt-1">
                  Embed this plan on your website or blog
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    value={embedCode}
                    readOnly
                    rows={3}
                    className="flex-1 font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => handleCopy(embedCode, 'embed')}
                  >
                    {copiedStates.embed ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                <div className="p-4 rounded-lg border bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
                  <div className="border rounded bg-white p-4 text-center text-sm text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>Plan embed preview</p>
                    <p className="text-xs">{plan.name}</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {isHost && (
            <TabsContent value="settings" className="space-y-6">
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium">Share Settings</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Control how others can interact with your shared plan
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Public Plan</Label>
                      <p className="text-xs text-gray-500">
                        Anyone with the link can view this plan
                      </p>
                    </div>
                    <Switch
                      checked={shareSettings.isPublic}
                      onCheckedChange={(checked) => 
                        setShareSettings(prev => ({ ...prev, isPublic: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Allow Copying</Label>
                      <p className="text-xs text-gray-500">
                        Let others copy this plan to their account
                      </p>
                    </div>
                    <Switch
                      checked={shareSettings.allowCopying}
                      onCheckedChange={(checked) => 
                        setShareSettings(prev => ({ ...prev, allowCopying: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Allow Comments</Label>
                      <p className="text-xs text-gray-500">
                        Let others comment on this plan
                      </p>
                    </div>
                    <Switch
                      checked={shareSettings.allowComments}
                      onCheckedChange={(checked) => 
                        setShareSettings(prev => ({ ...prev, allowComments: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Require Approval</Label>
                      <p className="text-xs text-gray-500">
                        Approve participants before they can join
                      </p>
                    </div>
                    <Switch
                      checked={shareSettings.requireApproval}
                      onCheckedChange={(checked) => 
                        setShareSettings(prev => ({ ...prev, requireApproval: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Enable Embedding</Label>
                      <p className="text-xs text-gray-500">
                        Allow this plan to be embedded on other websites
                      </p>
                    </div>
                    <Switch
                      checked={shareSettings.embedEnabled}
                      onCheckedChange={(checked) => 
                        setShareSettings(prev => ({ ...prev, embedEnabled: checked }))
                      }
                    />
                  </div>
                </div>

                <Button onClick={handleUpdateSettings} disabled={isLoading}>
                  Update Settings
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}