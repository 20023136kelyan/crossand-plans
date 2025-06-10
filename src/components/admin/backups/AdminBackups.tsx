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
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Database,
  Download,
  Upload,
  RefreshCcw,
  Calendar,
  Clock,
  HardDrive,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';

type BackupStatus = 'completed' | 'running' | 'failed' | 'scheduled';
type BackupType = 'full' | 'incremental' | 'differential';

interface Backup {
  id: string;
  name: string;
  type: BackupType;
  status: BackupStatus;
  size: string;
  createdAt: Date;
  duration: string;
  collections: string[];
  downloadUrl?: string;
  errorMessage?: string;
}

interface BackupSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
  backupTime: string;
  includeFiles: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

const defaultBackupSettings: BackupSettings = {
  autoBackup: true,
  backupFrequency: 'daily',
  retentionDays: 30,
  backupTime: '02:00',
  includeFiles: true,
  compressionEnabled: true,
  encryptionEnabled: true
};

export function AdminBackups() {
  const { user } = useAuth();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [settings, setSettings] = useState<BackupSettings>(defaultBackupSettings);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [currentBackup, setCurrentBackup] = useState<{ progress: number; status: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadBackupData();
    }
  }, [user]);

  const loadBackupData = async () => {
    setLoading(true);
    try {
      if (!user) {
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      const [backupsResponse, settingsResponse] = await Promise.all([
        fetch('/api/admin/backups', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/admin/backups/settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (backupsResponse.ok) {
        const backupsData = await backupsResponse.json();
        setBackups(backupsData.backups || []);
      }

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings({ ...defaultBackupSettings, ...settingsData });
      }
    } catch (error) {
      console.error('Failed to load backup data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load backup data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async (type: BackupType = 'full') => {
    setCreating(true);
    setCurrentBackup({ progress: 0, status: 'Initializing backup...' });
    
    try {
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to create backups.',
          variant: 'destructive'
        });
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/backups/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });

      if (response.ok) {
        const { backupId } = await response.json();
        
        // Track backup progress
        setCurrentBackup({ progress: 0, status: 'Initializing backup...' });
        
        // Poll for backup status
        const checkBackupStatus = async () => {
          try {
            const statusResponse = await fetch(`/api/admin/backups/${backupId}/status`);
            if (statusResponse.ok) {
              const status = await statusResponse.json();
              setCurrentBackup({
                progress: status.progress || 0,
                status: status.message || 'Processing backup...'
              });
              
              if (status.progress >= 100 || status.status === 'completed') {
                setCurrentBackup(null);
                fetchBackups();
                return;
              }
            }
          } catch (error) {
            console.error('Error checking backup status:', error);
          }
          
          // Continue polling if backup is still in progress
          setTimeout(checkBackupStatus, 2000);
        };
        
        checkBackupStatus();

        // Check backup status
        const checkStatus = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/admin/backups/${backupId}/status`);
            if (statusResponse.ok) {
              const status = await statusResponse.json();
              if (status.completed) {
                clearInterval(checkStatus);
                clearInterval(progressInterval);
                setCurrentBackup(null);
                loadBackupData();
                toast({
                  title: 'Success',
                  description: 'Backup created successfully'
                });
              }
            }
          } catch (error) {
            clearInterval(checkStatus);
            clearInterval(progressInterval);
            setCurrentBackup(null);
          }
        }, 2000);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create backup',
        variant: 'destructive'
      });
      setCurrentBackup(null);
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? This will overwrite current data.')) {
      return;
    }

    setRestoring(true);
    try {
      const response = await fetch(`/api/admin/backups/${backupId}/restore`, {
        method: 'POST'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Backup restoration initiated. This may take several minutes.'
        });
      } else {
        throw new Error('Failed to restore backup');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to restore backup',
        variant: 'destructive'
      });
    } finally {
      setRestoring(false);
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    try {
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to delete backups.',
          variant: 'destructive'
        });
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/backups/${backupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setBackups(prev => prev.filter(b => b.id !== backupId));
        toast({
          title: 'Success',
          description: 'Backup deleted successfully'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete backup',
        variant: 'destructive'
      });
    }
  };

  const updateSettings = async (newSettings: BackupSettings) => {
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
      const response = await fetch('/api/admin/backups/settings', {
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
          description: 'Backup settings updated'
        });
        setIsSettingsOpen(false);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: BackupStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <RefreshCcw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: BackupStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500';
      case 'running':
        return 'bg-blue-500/10 text-blue-500';
      case 'failed':
        return 'bg-red-500/10 text-red-500';
      case 'scheduled':
        return 'bg-yellow-500/10 text-yellow-500';
    }
  };

  const totalBackupSize = backups.reduce((total, backup) => {
    const sizeInMB = parseFloat(backup.size.replace(/[^0-9.]/g, ''));
    return total + (backup.size.includes('GB') ? sizeInMB * 1024 : sizeInMB);
  }, 0);

  const completedBackups = backups.filter(b => b.status === 'completed').length;
  const failedBackups = backups.filter(b => b.status === 'failed').length;

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
          <Database className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Backup Management</h2>
        </div>
        <div className="flex gap-2">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Backup Settings</DialogTitle>
                <DialogDescription>
                  Configure automatic backup preferences
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Automatic Backups</Label>
                  <Switch
                    checked={settings.autoBackup}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, autoBackup: checked }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Backup Frequency</Label>
                  <Select
                    value={settings.backupFrequency}
                    onValueChange={(value) => 
                      setSettings(prev => ({ ...prev, backupFrequency: value as any }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Backup Time</Label>
                  <Input
                    type="time"
                    value={settings.backupTime}
                    onChange={(e) => 
                      setSettings(prev => ({ ...prev, backupTime: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retention Period (days)</Label>
                  <Input
                    type="number"
                    value={settings.retentionDays}
                    onChange={(e) => 
                      setSettings(prev => ({ ...prev, retentionDays: parseInt(e.target.value) }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Include Files</Label>
                  <Switch
                    checked={settings.includeFiles}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, includeFiles: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Compression</Label>
                  <Switch
                    checked={settings.compressionEnabled}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, compressionEnabled: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Encryption</Label>
                  <Switch
                    checked={settings.encryptionEnabled}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, encryptionEnabled: checked }))
                    }
                  />
                </div>
                <Button onClick={() => updateSettings(settings)} className="w-full">
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => createBackup('full')} disabled={creating}>
            <Database className="h-4 w-4 mr-2" />
            {creating ? 'Creating...' : 'Create Backup'}
          </Button>
        </div>
      </div>

      {/* Current Backup Progress */}
      {currentBackup && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Creating Backup</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(currentBackup.progress)}%
                </span>
              </div>
              <Progress value={currentBackup.progress} className="w-full" />
              <p className="text-sm text-muted-foreground">{currentBackup.status}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backup Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Backups</p>
                <p className="text-2xl font-bold">{backups.length}</p>
              </div>
              <Database className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-500">{completedBackups}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-500">{failedBackups}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Size</p>
                <p className="text-2xl font-bold">
                  {totalBackupSize > 1024 ? 
                    `${(totalBackupSize / 1024).toFixed(1)}GB` : 
                    `${totalBackupSize.toFixed(0)}MB`
                  }
                </p>
              </div>
              <HardDrive className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backups Table */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>
            View and manage your database backups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="font-medium">{backup.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{backup.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(backup.status)}>
                      {getStatusIcon(backup.status)}
                      <span className="ml-1">{backup.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>{backup.size}</TableCell>
                  <TableCell>{new Date(backup.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{backup.duration}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {backup.status === 'completed' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreBackup(backup.id)}
                            disabled={restoring}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          {backup.downloadUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(backup.downloadUrl, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteBackup(backup.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}