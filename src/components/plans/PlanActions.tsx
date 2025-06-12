'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart,
  Share2,
  Copy,
  Calendar,
  Users,
  MapPin,
  Clock,
  Star,
  CheckCircle,
  XCircle,
  UserPlus,
  MessageCircle,
  Download,
  QrCode,
  Link,
  Mail,
  Crown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Plan as PlanType } from '@/types/user';

type UserRole = 'host' | 'confirmed' | 'invited' | 'public' | 'authenticated';

interface PlanActionsProps {
  plan: PlanType;
  userRole: UserRole;
  onRSVP: (response: 'yes' | 'no' | 'maybe') => void;
  onJoinRequest: () => void;
  onCopyPlan: () => void;
  className?: string;
}

export function PlanActions({
  plan,
  userRole,
  onRSVP,
  onJoinRequest,
  onCopyPlan,
  className
}: PlanActionsProps) {
  const isAuthenticated = userRole !== 'public';
  const currentUserId = userRole === 'host' ? plan.hostId : undefined;
  const [isSharing, setIsSharing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<'yes' | 'no' | 'maybe' | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);

  const planUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async (method: 'link' | 'qr' | 'email' | 'native') => {
    setIsSharing(true);
    
    try {
      switch (method) {
        case 'link':
          await navigator.clipboard.writeText(planUrl);
          toast.success('Plan link copied to clipboard!');
          break;
          
        case 'qr':
          setShowQRCode(true);
          break;
          
        case 'email':
          const emailSubject = encodeURIComponent(`Check out this plan: ${plan.name}`);
          const emailBody = encodeURIComponent(
            `Hi! I wanted to share this amazing plan with you:\n\n${plan.name}\n${plan.description || ''}\n\nView it here: ${planUrl}`
          );
          window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`);
          break;
          
        case 'native':
          if (navigator.share) {
            await navigator.share({
              title: plan.name,
              text: plan.description || `Check out this plan: ${plan.name}`,
              url: planUrl
            });
          } else {
            // Fallback to copy link
            await navigator.clipboard.writeText(planUrl);
            toast.success('Plan link copied to clipboard!');
          }
          break;
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share plan');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyPlan = async () => {
    if (!onCopyPlan) return;
    
    setIsCopying(true);
    try {
      await onCopyPlan();
      toast.success('Plan copied to your account!');
    } catch (error) {
      console.error('Error copying plan:', error);
      toast.error('Failed to copy plan');
    } finally {
      setIsCopying(false);
    }
  };

  const handleRSVP = async (response: 'yes' | 'no' | 'maybe') => {
    if (!onRSVP) return;
    
    try {
      await onRSVP(response);
      setRsvpStatus(response);
      toast.success(`RSVP updated: ${response === 'yes' ? 'Going' : response === 'no' ? 'Not going' : 'Maybe'}`);
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    }
  };

  const handleJoinRequest = async () => {
    if (!onJoinRequest) return;
    
    try {
      await onJoinRequest();
      toast.success('Join request sent!');
    } catch (error) {
      console.error('Error sending join request:', error);
      toast.error('Failed to send join request');
    }
  };

  const getRSVPButton = (response: 'yes' | 'no' | 'maybe', icon: React.ReactNode, label: string, variant: 'default' | 'destructive' | 'outline') => (
    <Button
      variant={rsvpStatus === response ? 'default' : variant}
      size="sm"
      onClick={() => handleRSVP(response)}
      className="flex-1"
    >
      {icon}
      {label}
    </Button>
  );

  const formatEventDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Quick Info Card */}
      <Card className="bg-background/30 backdrop-blur-sm border border-border/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Date</div>
                <div className="text-muted-foreground">
                  {plan.eventTime ? formatEventDate(plan.eventTime) : 'TBD'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Location</div>
                <div className="text-muted-foreground truncate">
                  {plan.location || 'Multiple locations'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Participants</div>
                <div className="text-muted-foreground">
                  {Object.values(plan.participantResponses || {}).filter(response => response === 'going').length} joined
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Rating</div>
                <div className="text-muted-foreground">
                  {plan.averageRating ? `${plan.averageRating.toFixed(1)}/5` : 'Not rated'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Actions Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 backdrop-blur-sm border border-border/30">
        <CardContent className="p-6">
          {/* Host View */}
          {userRole === 'host' && (
            <div className="space-y-4">
              <div className="text-center">
                <Badge variant="default" className="mb-2">
                  <Crown className="h-3 w-3 mr-1" />
                  Plan Host
                </Badge>
                <h3 className="text-lg font-semibold">Manage Your Plan</h3>
                <p className="text-sm text-muted-foreground">
                  You're hosting this amazing experience!
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button variant="default" className="w-full">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Participants
                </Button>
                <Button variant="outline" className="w-full">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Group Chat
                </Button>
              </div>
            </div>
          )}

          {/* Confirmed Participant View */}
          {userRole === 'confirmed' && (
            <div className="space-y-4">
              <div className="text-center">
                <Badge variant="default" className="mb-2">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Confirmed
                </Badge>
                <h3 className="text-lg font-semibold">You're Going!</h3>
                <p className="text-sm text-muted-foreground">
                  Get ready for an amazing experience.
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  {getRSVPButton('yes', <CheckCircle className="h-4 w-4 mr-1" />, 'Going', 'default')}
                  {getRSVPButton('maybe', <Clock className="h-4 w-4 mr-1" />, 'Maybe', 'outline')}
                  {getRSVPButton('no', <XCircle className="h-4 w-4 mr-1" />, 'Can\'t Go', 'destructive')}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="w-full">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Group Chat
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Calendar className="h-4 w-4 mr-2" />
                    Add to Calendar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Invited Participant View */}
          {userRole === 'invited' && (
            <div className="space-y-4">
              <div className="text-center">
                <Badge variant="secondary" className="mb-2">
                  <Mail className="h-3 w-3 mr-1" />
                  Invited
                </Badge>
                <h3 className="text-lg font-semibold">You're Invited!</h3>
                <p className="text-sm text-muted-foreground">
                  Please respond to this invitation.
                </p>
              </div>
              
              <div className="flex gap-2">
                {getRSVPButton('yes', <CheckCircle className="h-4 w-4 mr-1" />, 'Accept', 'default')}
                {getRSVPButton('maybe', <Clock className="h-4 w-4 mr-1" />, 'Maybe', 'outline')}
                {getRSVPButton('no', <XCircle className="h-4 w-4 mr-1" />, 'Decline', 'destructive')}
              </div>
            </div>
          )}

          {/* Authenticated Non-Participant View */}
          {userRole === 'authenticated' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Interested in Joining?</h3>
                <p className="text-sm text-muted-foreground">
                  Request to join this plan or copy it to create your own version.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleJoinRequest} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Request to Join
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCopyPlan}
                  disabled={isCopying}
                  className="w-full"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {isCopying ? 'Copying...' : 'Copy Plan'}
                </Button>
              </div>
            </div>
          )}

          {/* Public/Unauthenticated View */}
          {userRole === 'public' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Love This Plan?</h3>
                <p className="text-sm text-muted-foreground">
                  {isAuthenticated 
                    ? 'Copy this plan to your account to customize it.'
                    : 'Sign in to copy this plan and make it your own.'
                  }
                </p>
              </div>
              
              {isAuthenticated ? (
                <Button 
                  onClick={handleCopyPlan}
                  disabled={isCopying}
                  className="w-full"
                  size="lg"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {isCopying ? 'Copying...' : 'Copy to My Plans'}
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button className="w-full" size="lg">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign In to Copy Plan
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Free account • No credit card required
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Share Actions - Always Available */}
          <div className="pt-4 border-t border-border/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Share this plan</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleShare('link')}
                  disabled={isSharing}
                >
                  <Link className="h-4 w-4" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={isSharing}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleShare('native')}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShare('link')}>
                      <Link className="h-4 w-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShare('qr')}>
                      <QrCode className="h-4 w-4 mr-2" />
                      QR Code
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleShare('email')}>
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Plan QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to view the plan on any device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-4 rounded-lg">
              {/* QR Code would be generated here */}
              <div className="w-48 h-48 bg-muted flex items-center justify-center">
                <QrCode className="h-16 w-16 text-muted-foreground" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              QR code for: {plan.name}
            </p>
            <Button onClick={() => handleShare('link')} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}