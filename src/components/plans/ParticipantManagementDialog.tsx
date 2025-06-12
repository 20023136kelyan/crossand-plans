'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Search, 
  Filter, 
  Mail, 
  MessageSquare, 
  UserPlus, 
  UserMinus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  HelpCircle,
  Crown,
  MoreHorizontal,
  Send,
  Copy,
  Download
} from 'lucide-react';
import { Plan, ParticipantResponse } from '@/types/plan';
import { RSVPDetails } from '@/types/user';
import { User } from 'firebase/auth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ParticipantManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  currentUser: User | null;
  isHost: boolean;
  onSendReminder: (userIds: string[], message?: string) => Promise<void>;
  onSendMessage: (userIds: string[], message: string) => Promise<void>;
  onRemoveParticipant: (userId: string) => Promise<void>;
  onPromoteToHost: (userId: string) => Promise<void>;
  onExportParticipants: () => Promise<void>;
}

type RSVPFilter = 'all' | 'going' | 'maybe' | 'not-going' | 'pending';
type ParticipantSort = 'name' | 'rsvp-date' | 'status';

interface ParticipantWithDetails {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  status: ParticipantResponse;
  rsvpDetails?: RSVPDetails;
  rsvpDate?: string;
  isHost: boolean;
}

export function ParticipantManagementDialog({
  open,
  onOpenChange,
  plan,
  currentUser,
  isHost,
  onSendReminder,
  onSendMessage,
  onRemoveParticipant,
  onPromoteToHost,
  onExportParticipants
}: ParticipantManagementDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [rsvpFilter, setRSVPFilter] = useState<RSVPFilter>('all');
  const [sortBy, setSortBy] = useState<ParticipantSort>('name');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [reminderMessage, setReminderMessage] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Mock participant data - in real app, this would come from props or API
  const participants: ParticipantWithDetails[] = useMemo(() => {
    const mockParticipants: ParticipantWithDetails[] = [
      {
        userId: plan.hostId,
        name: 'Host User',
        email: 'host@example.com',
        status: 'going',
        isHost: true,
        rsvpDate: new Date().toISOString()
      },
      ...plan.invitedParticipantUserIds.map((userId, index) => ({
        userId,
        name: `User ${index + 1}`,
        email: `user${index + 1}@example.com`,
        status: plan.participantResponses[userId] || 'pending',
        rsvpDetails: plan.participantRSVPDetails?.[userId],
        isHost: false,
        rsvpDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }))
    ];
    return mockParticipants;
  }, [plan]);

  const filteredAndSortedParticipants = useMemo(() => {
    let filtered = participants.filter(participant => {
      const matchesSearch = participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           participant.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = rsvpFilter === 'all' || participant.status === rsvpFilter;
      return matchesSearch && matchesFilter;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rsvp-date':
          return new Date(b.rsvpDate || 0).getTime() - new Date(a.rsvpDate || 0).getTime();
        case 'status':
          const statusOrder = { 'going': 0, 'maybe': 1, 'pending': 2, 'not-going': 3 };
          return statusOrder[a.status] - statusOrder[b.status];
        default:
          return 0;
      }
    });

    return filtered;
  }, [participants, searchQuery, rsvpFilter, sortBy]);

  const rsvpCounts = useMemo(() => {
    return participants.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<ParticipantResponse, number>);
  }, [participants]);

  const getStatusIcon = (status: ParticipantResponse) => {
    switch (status) {
      case 'going': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'maybe': return <HelpCircle className="h-4 w-4 text-yellow-600" />;
      case 'not-going': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ParticipantResponse) => {
    const variants = {
      'going': 'default',
      'maybe': 'secondary',
      'not-going': 'destructive',
      'pending': 'outline'
    } as const;

    return (
      <Badge variant={variants[status]} className="text-xs">
        {status === 'not-going' ? "Can't Go" : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleSelectParticipant = (userId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedParticipants.length === filteredAndSortedParticipants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(filteredAndSortedParticipants.map(p => p.userId));
    }
  };

  const handleSendReminder = async () => {
    if (selectedParticipants.length === 0) return;
    
    setIsLoading(true);
    try {
      await onSendReminder(selectedParticipants, reminderMessage.trim() || undefined);
      setSelectedParticipants([]);
      setReminderMessage('');
    } catch (error) {
      console.error('Error sending reminder:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (selectedParticipants.length === 0 || !customMessage.trim()) return;
    
    setIsLoading(true);
    try {
      await onSendMessage(selectedParticipants, customMessage.trim());
      setSelectedParticipants([]);
      setCustomMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isHost) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Participants
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="participants" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="participants">Participants ({participants.length})</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="participants" className="space-y-4 overflow-hidden">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border bg-green-50 border-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Going</span>
                </div>
                <p className="text-2xl font-bold text-green-900">{rsvpCounts.going || 0}</p>
              </div>
              <div className="p-3 rounded-lg border bg-yellow-50 border-yellow-200">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Maybe</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900">{rsvpCounts.maybe || 0}</p>
              </div>
              <div className="p-3 rounded-lg border bg-red-50 border-red-200">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Can't Go</span>
                </div>
                <p className="text-2xl font-bold text-red-900">{rsvpCounts['not-going'] || 0}</p>
              </div>
              <div className="p-3 rounded-lg border bg-gray-50 border-gray-200">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-800">Pending</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{rsvpCounts.pending || 0}</p>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search participants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={rsvpFilter} onValueChange={(value) => setRSVPFilter(value as RSVPFilter)}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="going">Going</SelectItem>
                  <SelectItem value="maybe">Maybe</SelectItem>
                  <SelectItem value="not-going">Can't Go</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as ParticipantSort)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="rsvp-date">RSVP Date</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bulk Actions */}
            {selectedParticipants.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-sm font-medium text-blue-800">
                  {selectedParticipants.length} selected
                </span>
                <Button size="sm" variant="outline" onClick={() => setSelectedParticipants([])}>
                  Clear
                </Button>
                <Button size="sm" onClick={handleSendReminder} disabled={isLoading}>
                  <Mail className="h-4 w-4 mr-1" />
                  Send Reminder
                </Button>
                <Button size="sm" variant="outline">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Message
                </Button>
              </div>
            )}

            {/* Participants List */}
            <ScrollArea className="h-96 border rounded-lg">
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.length === filteredAndSortedParticipants.length && filteredAndSortedParticipants.length > 0}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Select All</span>
                </div>
                
                {filteredAndSortedParticipants.map((participant) => (
                  <div key={participant.userId} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.includes(participant.userId)}
                      onChange={() => handleSelectParticipant(participant.userId)}
                      className="rounded"
                    />
                    
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={participant.avatar} />
                      <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{participant.name}</span>
                        {participant.isHost && <Crown className="h-4 w-4 text-yellow-500" />}
                      </div>
                      <p className="text-sm text-gray-500">{participant.email}</p>
                      {participant.rsvpDetails && (
                        <div className="text-xs text-gray-400 mt-1">
                          {participant.rsvpDetails.guestCount && participant.rsvpDetails.guestCount > 0 && (
                            <span>+{participant.rsvpDetails.guestCount} guests • </span>
                          )}
                          {participant.rsvpDetails.dietaryRestrictions && participant.rsvpDetails.dietaryRestrictions.length > 0 && (
                            <span>
                              {participant.rsvpDetails.dietaryRestrictions.map((restriction: string, index: number) => (
                                <span key={`${participant.userId}-restriction-${index}`}>
                                  {restriction}{index < participant.rsvpDetails!.dietaryRestrictions!.length - 1 ? ', ' : ''}
                                </span>
                              ))} • 
                            </span>
                          )}
                          {participant.rsvpDetails.specialRequests && (
                            <span>Special requests</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusIcon(participant.status)}
                      {getStatusBadge(participant.status)}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onSendMessage([participant.userId], '')}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Send Message
                          </DropdownMenuItem>
                          {!participant.isHost && (
                            <>
                              <DropdownMenuItem onClick={() => onPromoteToHost(participant.userId)}>
                                <Crown className="h-4 w-4 mr-2" />
                                Make Host
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => onRemoveParticipant(participant.userId)}
                                className="text-red-600"
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="communication" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Send Reminder */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Send RSVP Reminder</h3>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Optional custom message..."
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    rows={3}
                  />
                  <Button 
                    onClick={handleSendReminder} 
                    disabled={selectedParticipants.length === 0 || isLoading}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send to {selectedParticipants.length} Selected
                  </Button>
                </div>
              </div>

              {/* Send Custom Message */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Send Custom Message</h3>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Type your message..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={selectedParticipants.length === 0 || !customMessage.trim() || isLoading}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send to {selectedParticipants.length} Selected
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* RSVP Timeline */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">RSVP Timeline</h3>
                <div className="space-y-2">
                  {participants
                    .filter(p => p.rsvpDate)
                    .sort((a, b) => new Date(b.rsvpDate!).getTime() - new Date(a.rsvpDate!).getTime())
                    .slice(0, 5)
                    .map((participant) => (
                      <div key={participant.userId} className="flex items-center gap-3 p-2 rounded border">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{participant.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(participant.rsvpDate!).toLocaleDateString()}
                          </p>
                        </div>
                        {getStatusBadge(participant.status)}
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Export Options */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Export Data</h3>
                <div className="space-y-2">
                  <Button variant="outline" onClick={onExportParticipants} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export Participant List
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Email Addresses
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
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