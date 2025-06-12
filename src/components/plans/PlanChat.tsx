'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageCircle,
  Send,
  Users,
  MoreVertical,
  Pin,
  Reply,
  Heart,
  Smile,
  Image as ImageIcon,
  Paperclip
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Plan as PlanType } from '@/types/user';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'image' | 'system';
  reactions?: { emoji: string; users: string[] }[];
  isPinned?: boolean;
  replyTo?: string;
}

interface PlanChatProps {
  plan: PlanType;
  planId: string;
  currentUser: any;
  isParticipant: boolean;
  className?: string;
}

export function PlanChat({ plan, planId, currentUser, isParticipant, className }: PlanChatProps) {
  const currentUserId = currentUser?.uid;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mock data for demonstration
  useEffect(() => {
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        userId: 'system',
        userName: 'System',
        message: `Welcome to the ${plan.name} group chat!`,
        timestamp: new Date(Date.now() - 86400000), // 1 day ago
        type: 'system'
      },
      {
        id: '2',
        userId: 'user1',
        userName: 'Alice Johnson',
        userAvatar: '/avatars/alice.jpg',
        message: 'Hey everyone! So excited for this trip! 🎉',
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        type: 'text',
        reactions: [{ emoji: '❤️', users: ['user2', 'user3'] }]
      },
      {
        id: '3',
        userId: 'user2',
        userName: 'Bob Smith',
        userAvatar: '/avatars/bob.jpg',
        message: 'Should we meet at the first location or travel together?',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        type: 'text',
        isPinned: true
      },
      {
        id: '4',
        userId: 'user3',
        userName: 'Carol Davis',
        userAvatar: '/avatars/carol.jpg',
        message: 'I can pick up 2 people if needed!',
        timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
        type: 'text',
        replyTo: '3'
      }
    ];
    setMessages(mockMessages);
    setOnlineUsers(['user1', 'user2', 'user3']);
  }, [plan.name]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !isParticipant) return;

    setIsLoading(true);
    
    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: currentUserId,
      userName: 'You', // This would come from user data
      message: newMessage.trim(),
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
    setIsLoading(false);
    
    // Focus back to input
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const addReaction = (messageId: string, emoji: string) => {
    if (!currentUserId) return;
    
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || [];
        const existingReaction = reactions.find(r => r.emoji === emoji);
        
        if (existingReaction) {
          if (existingReaction.users.includes(currentUserId)) {
            // Remove reaction
            existingReaction.users = existingReaction.users.filter(id => id !== currentUserId);
            if (existingReaction.users.length === 0) {
              return { ...msg, reactions: reactions.filter(r => r.emoji !== emoji) };
            }
          } else {
            // Add reaction
            existingReaction.users.push(currentUserId);
          }
        } else {
          // New reaction
          reactions.push({ emoji, users: [currentUserId] });
        }
        
        return { ...msg, reactions };
      }
      return msg;
    }));
  };

  const togglePin = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg
    ));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getReplyMessage = (replyToId: string) => {
    return messages.find(msg => msg.id === replyToId);
  };

  if (!isParticipant) {
    return (
      <Card className={`bg-background/30 backdrop-blur-sm border border-border/30 ${className || ''}`}>
        <CardContent className="p-8 text-center">
          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Group Chat</h3>
          <p className="text-muted-foreground mb-4">
            Join this plan to participate in the group chat and coordinate with other participants.
          </p>
          <Badge variant="outline">Participants Only</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-background/30 backdrop-blur-sm border border-border/30 ${className || ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Group Chat
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-background/50 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {onlineUsers.length} online
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Messages Container */}
        <div className="h-96 overflow-y-auto px-6 space-y-4">
          {messages.map((message, index) => {
            const showDate = index === 0 || 
              formatDate(message.timestamp) !== formatDate(messages[index - 1].timestamp);
            const replyMessage = message.replyTo ? getReplyMessage(message.replyTo) : null;
            
            return (
              <div key={message.id}>
                {showDate && (
                  <div className="text-center my-4">
                    <Badge variant="outline" className="bg-background/50">
                      {formatDate(message.timestamp)}
                    </Badge>
                  </div>
                )}
                
                <div className={`flex gap-3 group ${
                  message.type === 'system' ? 'justify-center' : 
                  message.userId === currentUserId ? 'flex-row-reverse' : ''
                }`}>
                  {message.type !== 'system' && message.userId !== currentUserId && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src={message.userAvatar} />
                      <AvatarFallback>{message.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`flex-1 max-w-xs md:max-w-md ${
                    message.type === 'system' ? 'text-center' : 
                    message.userId === currentUserId ? 'text-right' : ''
                  }`}>
                    {message.type === 'system' ? (
                      <div className="text-sm text-muted-foreground bg-muted/50 rounded-full px-3 py-1 inline-block">
                        {message.message}
                      </div>
                    ) : (
                      <div className={`rounded-lg p-3 relative ${
                        message.userId === currentUserId 
                          ? 'bg-primary text-primary-foreground ml-auto' 
                          : 'bg-muted'
                      }`}>
                        {message.isPinned && (
                          <Pin className="h-3 w-3 absolute -top-1 -right-1 text-yellow-500" />
                        )}
                        
                        {message.userId !== currentUserId && (
                          <div className="text-xs font-semibold mb-1 text-primary">
                            {message.userName}
                          </div>
                        )}
                        
                        {replyMessage && (
                          <div className="text-xs opacity-70 mb-2 pl-2 border-l-2 border-current">
                            <div className="font-semibold">{replyMessage.userName}</div>
                            <div className="truncate">{replyMessage.message}</div>
                          </div>
                        )}
                        
                        <div className="text-sm">{message.message}</div>
                        
                        <div className="text-xs opacity-70 mt-1">
                          {formatTime(message.timestamp)}
                        </div>
                        
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {message.reactions.map((reaction, idx) => (
                              <button
                                key={idx}
                                onClick={() => addReaction(message.id, reaction.emoji)}
                                className={`text-xs px-1 py-0.5 rounded-full border ${
                                  reaction.users.includes(currentUserId || '') 
                                    ? 'bg-primary/20 border-primary' 
                                    : 'bg-background/50 border-border'
                                }`}
                              >
                                {reaction.emoji} {reaction.users.length}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Message Actions */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => addReaction(message.id, '❤️')}>
                                <Heart className="h-4 w-4 mr-2" />
                                React
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => togglePin(message.id)}>
                                <Pin className="h-4 w-4 mr-2" />
                                {message.isPinned ? 'Unpin' : 'Pin'}
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Reply className="h-4 w-4 mr-2" />
                                Reply
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Message Input */}
        <div className="p-4 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ImageIcon className="h-4 w-4" />
            </Button>
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                disabled={isLoading}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isLoading}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}