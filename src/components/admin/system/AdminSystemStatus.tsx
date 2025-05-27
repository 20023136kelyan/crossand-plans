import { useState } from 'react';
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
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Database,
  HardDrive,
  LineChart,
  RefreshCcw,
  Server,
  Settings,
  XCircle,
} from 'lucide-react';

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'maintenance';
type MetricTrend = 'up' | 'down' | 'stable';

interface SystemService {
  name: string;
  status: ServiceStatus;
  uptime: string;
  lastIncident: string;
  responseTime: string;
}

interface SystemMetric {
  name: string;
  value: string;
  trend: MetricTrend;
  change: string;
}

const mockServices: SystemService[] = [
  {
    name: 'API Server',
    status: 'operational',
    uptime: '99.99%',
    lastIncident: 'None',
    responseTime: '120ms',
  },
  {
    name: 'Database',
    status: 'operational',
    uptime: '99.95%',
    lastIncident: '3 days ago',
    responseTime: '45ms',
  },
  {
    name: 'Storage',
    status: 'degraded',
    uptime: '99.5%',
    lastIncident: '1 hour ago',
    responseTime: '200ms',
  },
  {
    name: 'Authentication',
    status: 'operational',
    uptime: '99.99%',
    lastIncident: '7 days ago',
    responseTime: '85ms',
  },
];

const mockMetrics: SystemMetric[] = [
  {
    name: 'CPU Usage',
    value: '45%',
    trend: 'stable',
    change: '0%',
  },
  {
    name: 'Memory Usage',
    value: '65%',
    trend: 'up',
    change: '+5%',
  },
  {
    name: 'Disk Space',
    value: '72%',
    trend: 'up',
    change: '+2%',
  },
  {
    name: 'Network Load',
    value: '38%',
    trend: 'down',
    change: '-8%',
  },
];

export function AdminSystemStatus() {
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const getStatusIcon = (status: ServiceStatus) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'down':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'maintenance':
        return <Settings className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'operational':
        return 'text-green-500 bg-green-500/10';
      case 'degraded':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'down':
        return 'text-red-500 bg-red-500/10';
      case 'maintenance':
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getTrendIcon = (trend: MetricTrend) => {
    switch (trend) {
      case 'up':
        return <LineChart className="h-4 w-4 text-red-500" />;
      case 'down':
        return <LineChart className="h-4 w-4 text-green-500" />;
      case 'stable':
        return <LineChart className="h-4 w-4 text-blue-500" />;
    }
  };

  const handleRefresh = () => {
    setLastUpdated(new Date());
    // Add actual refresh logic here
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">System Status</h2>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockMetrics.map((metric) => (
          <Card key={metric.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.name}
              </CardTitle>
              {getTrendIcon(metric.trend)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground">
                {metric.change} from last hour
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Service Status</CardTitle>
              <Badge variant="outline" className="gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                All Systems Operational
              </Badge>
            </div>
            <CardDescription>Current status of all services</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Last Incident</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockServices.map((service) => (
                  <TableRow key={service.name}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        {service.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(service.status)}
                        <span className={`text-sm ${getStatusColor(service.status)} px-2 py-1 rounded-full`}>
                          {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{service.uptime}</TableCell>
                    <TableCell>{service.responseTime}</TableCell>
                    <TableCell>{service.lastIncident}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Resources</CardTitle>
              <CardDescription>Real-time resource utilization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span>CPU Load</span>
                  </div>
                  <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '45%' }} />
                  </div>
                  <span className="text-sm">45%</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>Memory Usage</span>
                  </div>
                  <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '65%' }} />
                  </div>
                  <span className="text-sm">65%</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    <span>Disk Usage</span>
                  </div>
                  <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '72%' }} />
                  </div>
                  <span className="text-sm">72%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>System notifications and warnings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">High Memory Usage</h4>
                    <p className="text-sm text-muted-foreground">
                      Memory usage exceeded 65% threshold
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      2 hours ago
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">Service Recovered</h4>
                    <p className="text-sm text-muted-foreground">
                      Storage service has returned to normal operation
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      1 day ago
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 