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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Plug,
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCcw,
  ExternalLink,
  Key,
  Mail,
  MessageSquare,
  CreditCard,
  Calendar,
  Map,
} from 'lucide-react';

type IntegrationType = 'payment' | 'email' | 'sms' | 'calendar' | 'maps' | 'analytics' | 'storage' | 'other';
type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending';

interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  description: string;
  status: IntegrationStatus;
  enabled: boolean;
  apiKey?: string;
  webhookUrl?: string;
  settings: Record<string, any>;
  lastSync?: Date;
  errorMessage?: string;
}

const defaultIntegrations: Integration[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    type: 'payment',
    description: 'Payment processing and subscription management',
    status: 'active',
    enabled: true,
    settings: {
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: '',
      currency: 'usd'
    }
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    type: 'email',
    description: 'Email delivery service for notifications',
    status: 'inactive',
    enabled: false,
    settings: {
      apiKey: '',
      fromEmail: 'noreply@crossandplans.com',
      fromName: 'Crossand Plans'
    }
  },
  {
    id: 'twilio',
    name: 'Twilio',
    type: 'sms',
    description: 'SMS notifications and verification',
    status: 'inactive',
    enabled: false,
    settings: {
      accountSid: '',
      authToken: '',
      fromNumber: ''
    }
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    type: 'calendar',
    description: 'Calendar integration for plan scheduling',
    status: 'pending',
    enabled: false,
    settings: {
      clientId: '',
      clientSecret: '',
      redirectUri: ''
    }
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    type: 'maps',
    description: 'Location services and mapping',
    status: 'active',
    enabled: true,
    settings: {
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
    }
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    type: 'analytics',
    description: 'Website analytics and user tracking',
    status: 'inactive',
    enabled: false,
    settings: {
      trackingId: '',
      measurementId: ''
    }
  }
];

export function AdminIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      if (!user) {
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/integrations', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data.length > 0 ? data : defaultIntegrations);
      }
    } catch (error) {
      console.error('Failed to load integrations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load integrations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveIntegration = async (integration: Integration) => {
    try {
      if (!user) return;

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/integrations', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(integration)
      });

      if (response.ok) {
        setIntegrations(prev => 
          prev.map(i => i.id === integration.id ? integration : i)
        );
        toast({
          title: 'Success',
          description: 'Integration updated successfully'
        });
        setIsDialogOpen(false);
        setEditingIntegration(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update integration',
        variant: 'destructive'
      });
    }
  };

  const testIntegration = async (integrationId: string) => {
    try {
      if (!user) return;

      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/integrations/${integrationId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        setIntegrations(prev => 
          prev.map(i => i.id === integrationId ? 
            { ...i, status: 'active', errorMessage: undefined } : i
          )
        );
        toast({
          title: 'Success',
          description: 'Integration test successful'
        });
      } else {
        setIntegrations(prev => 
          prev.map(i => i.id === integrationId ? 
            { ...i, status: 'error', errorMessage: result.error } : i
          )
        );
        toast({
          title: 'Test Failed',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test integration',
        variant: 'destructive'
      });
    }
  };

  const toggleIntegration = async (integrationId: string, enabled: boolean) => {
    const integration = integrations.find(i => i.id === integrationId);
    if (!integration) return;

    const updatedIntegration = { ...integration, enabled };
    await saveIntegration(updatedIntegration);
  };

  const getTypeIcon = (type: IntegrationType) => {
    switch (type) {
      case 'payment':
        return <CreditCard className="h-5 w-5" />;
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5" />;
      case 'calendar':
        return <Calendar className="h-5 w-5" />;
      case 'maps':
        return <Map className="h-5 w-5" />;
      case 'analytics':
        return <RefreshCcw className="h-5 w-5" />;
      default:
        return <Plug className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: IntegrationStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500';
      case 'inactive':
        return 'bg-gray-500/10 text-gray-500';
      case 'error':
        return 'bg-red-500/10 text-red-500';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500';
    }
  };

  const getStatusIcon = (status: IntegrationStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

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
          <Plug className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Integrations</h2>
        </div>
        <Button onClick={loadIntegrations}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Integration Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-500">
                  {integrations.filter(i => i.status === 'active').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-gray-500">
                  {integrations.filter(i => i.status === 'inactive').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-500">
                  {integrations.filter(i => i.status === 'error').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{integrations.length}</p>
              </div>
              <Plug className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTypeIcon(integration.type)}
                  <CardTitle className="text-lg">{integration.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(integration.status)}>
                    {getStatusIcon(integration.status)}
                    <span className="ml-1">{integration.status}</span>
                  </Badge>
                  <Switch
                    checked={integration.enabled}
                    onCheckedChange={(enabled) => toggleIntegration(integration.id, enabled)}
                  />
                </div>
              </div>
              <CardDescription>{integration.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {integration.errorMessage && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                  <p className="text-sm text-red-500">{integration.errorMessage}</p>
                </div>
              )}
              
              {integration.lastSync && (
                <p className="text-sm text-muted-foreground mb-4">
                  Last sync: {new Date(integration.lastSync).toLocaleString()}
                </p>
              )}
              
              <div className="flex gap-2">
                <Dialog open={isDialogOpen && editingIntegration?.id === integration.id} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingIntegration(integration);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Configure {integration.name}</DialogTitle>
                      <DialogDescription>
                        Update integration settings and credentials
                      </DialogDescription>
                    </DialogHeader>
                    {editingIntegration && (
                      <div className="space-y-4">
                        {Object.entries(editingIntegration.settings).map(([key, value]) => (
                          <div key={key} className="space-y-2">
                            <Label htmlFor={key}>
                              {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                            </Label>
                            {key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') ? (
                              <div className="relative">
                                <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id={key}
                                  type="password"
                                  value={value as string}
                                  onChange={(e) => {
                                    setEditingIntegration(prev => prev ? {
                                      ...prev,
                                      settings: { ...prev.settings, [key]: e.target.value }
                                    } : null);
                                  }}
                                  className="pl-10"
                                  placeholder={`Enter ${key}`}
                                />
                              </div>
                            ) : (
                              <Input
                                id={key}
                                value={value as string}
                                onChange={(e) => {
                                  setEditingIntegration(prev => prev ? {
                                    ...prev,
                                    settings: { ...prev.settings, [key]: e.target.value }
                                  } : null);
                                }}
                                placeholder={`Enter ${key}`}
                              />
                            )}
                          </div>
                        ))}
                        <div className="flex gap-2 pt-4">
                          <Button
                            onClick={() => editingIntegration && saveIntegration(editingIntegration)}
                            className="flex-1"
                          >
                            Save Changes
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsDialogOpen(false);
                              setEditingIntegration(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testIntegration(integration.id)}
                  disabled={!integration.enabled}
                >
                  <RefreshCcw className="h-4 w-4 mr-1" />
                  Test
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}