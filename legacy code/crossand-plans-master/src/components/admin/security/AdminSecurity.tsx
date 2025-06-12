'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  AlertTriangle,
  Eye,
  Lock,
  UserX,
  Activity,
  RefreshCcw,
  Search,
  Ban,
  CheckCircle,
  XCircle,
} from 'lucide-react';

type SecurityEventType = 'login_attempt' | 'failed_login' | 'suspicious_activity' | 'data_access' | 'admin_action';
type SecurityLevel = 'low' | 'medium' | 'high' | 'critical';

interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  level: SecurityLevel;
  message: string;
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  resolved: boolean;
}

interface SecuritySettings {
  enableTwoFactor: boolean;
  requireStrongPasswords: boolean;
  maxLoginAttempts: number;
  lockoutDuration: number;
  enableIpWhitelist: boolean;
  enableAuditLog: boolean;
  sessionTimeout: number;
}

const defaultSecuritySettings: SecuritySettings = {
  enableTwoFactor: false,
  requireStrongPasswords: true,
  maxLoginAttempts: 5,
  lockoutDuration: 30,
  enableIpWhitelist: false,
  enableAuditLog: true,
  sessionTimeout: 24
};

export function AdminSecurity() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [settings, setSettings] = useState<SecuritySettings>(defaultSecuritySettings);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<SecurityLevel | 'all'>('all');
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadSecurityData();
    }
  }, [user]);

  const loadSecurityData = async () => {
    setLoading(true);
    try {
      if (!user) {
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      const [eventsResponse, settingsResponse] = await Promise.all([
        fetch('/api/admin/security/events', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/admin/security/settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        // Extract events array from response object
        const events = eventsData.events || [];
        setEvents(Array.isArray(events) ? events : []);
      }

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings({ ...defaultSecuritySettings, ...settingsData });
      }
    } catch (error) {
      console.error('Failed to load security data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load security data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: SecuritySettings) => {
    try {
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to update settings.',
          variant: 'destructive'
        });
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/security/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        setSettings(newSettings);
        toast({
          title: 'Success',
          description: 'Security settings updated'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive'
      });
    }
  };

  const resolveEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/admin/security/events/${eventId}/resolve`, {
        method: 'POST'
      });

      if (response.ok) {
        setEvents(prev => prev.map(event => 
          event.id === eventId ? { ...event, resolved: true } : event
        ));
        toast({
          title: 'Success',
          description: 'Security event resolved'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve event',
        variant: 'destructive'
      });
    }
  };

  const blockUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'POST'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'User has been blocked'
        });
        loadSecurityData();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to block user',
        variant: 'destructive'
      });
    }
  };

  const getEventIcon = (type: SecurityEventType) => {
    switch (type) {
      case 'login_attempt':
        return <Eye className="h-4 w-4" />;
      case 'failed_login':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'suspicious_activity':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'data_access':
        return <Lock className="h-4 w-4 text-blue-500" />;
      case 'admin_action':
        return <Shield className="h-4 w-4 text-green-500" />;
    }
  };

  const getLevelColor = (level: SecurityLevel) => {
    switch (level) {
      case 'low':
        return 'bg-green-500/10 text-green-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'high':
        return 'bg-orange-500/10 text-orange-500';
      case 'critical':
        return 'bg-red-500/10 text-red-500';
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.ipAddress?.includes(searchTerm);
    const matchesLevel = filterLevel === 'all' || event.level === filterLevel;
    return matchesSearch && matchesLevel;
  });

  const criticalEvents = events.filter(e => e.level === 'critical' && !e.resolved).length;
  const highEvents = events.filter(e => e.level === 'high' && !e.resolved).length;
  const recentEvents = events.filter(e => {
    if (!e.timestamp) return false;
    const timestamp = new Date(e.timestamp);
    return new Date().getTime() - timestamp.getTime() < 24 * 60 * 60 * 1000;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Security Management</h2>
        </div>
        <Button onClick={loadSecurityData}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Events</p>
                <p className="text-2xl font-bold text-red-500">{criticalEvents}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-orange-500">{highEvents}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Events (24h)</p>
                <p className="text-2xl font-bold">{recentEvents}</p>
              </div>
              <Activity className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{events.length}</p>
              </div>
              <Eye className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Events */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>
                Monitor and manage security events
              </CardDescription>
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value as SecurityLevel | 'all')}
                  className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="all" className="bg-background text-foreground">All Levels</option>
                  <option value="critical" className="bg-background text-foreground">Critical</option>
                  <option value="high" className="bg-background text-foreground">High</option>
                  <option value="medium" className="bg-background text-foreground">Medium</option>
                  <option value="low" className="bg-background text-foreground">Low</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.slice(0, 10).map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEventIcon(event.type)}
                          <div>
                            <p className="font-medium">{event.message}</p>
                            <p className="text-sm text-muted-foreground">{event.ipAddress}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getLevelColor(event.level)}>
                          {event.level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.userEmail || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {new Date(event.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {!event.resolved && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveEvent(event.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {event.userId && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => blockUser(event.userId!)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>
              Configure security policies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Two-Factor Authentication</Label>
              <Switch
                checked={settings.enableTwoFactor}
                onCheckedChange={(checked) => 
                  updateSettings({ ...settings, enableTwoFactor: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Strong Password Policy</Label>
              <Switch
                checked={settings.requireStrongPasswords}
                onCheckedChange={(checked) => 
                  updateSettings({ ...settings, requireStrongPasswords: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>IP Whitelist</Label>
              <Switch
                checked={settings.enableIpWhitelist}
                onCheckedChange={(checked) => 
                  updateSettings({ ...settings, enableIpWhitelist: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Audit Logging</Label>
              <Switch
                checked={settings.enableAuditLog}
                onCheckedChange={(checked) => 
                  updateSettings({ ...settings, enableAuditLog: checked })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Login Attempts</Label>
              <Input
                type="number"
                value={settings.maxLoginAttempts}
                onChange={(e) => 
                  updateSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Lockout Duration (minutes)</Label>
              <Input
                type="number"
                value={settings.lockoutDuration}
                onChange={(e) => 
                  updateSettings({ ...settings, lockoutDuration: parseInt(e.target.value) })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}