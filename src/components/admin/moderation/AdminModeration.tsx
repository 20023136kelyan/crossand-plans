import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle,
  Flag,
  MoreVertical,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';

type ContentType = 'plan' | 'comment' | 'profile' | 'message';
type ContentStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

interface ReportedContent {
  id: string;
  type: ContentType;
  status: ContentStatus;
  reportCount: number;
  reportedBy: string;
  reportedUser: string;
  content: string;
  dateReported: string;
}

interface ModerationStats {
  averageResponseTime: string;
  reportsToday: number;
  resolutionRate: number;
  pendingCount: number;
  flaggedCount: number;
  rejectedCount: number;
}

interface ApiReportedContent {
  id: string;
  type: string;
  status: string;
  reportCount: number;
  reportedBy: string;
  reportedUser: string;
  content: string;
  dateReported: string;
  contentId: string;
  reportReason: string;
}

export function AdminModeration() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContentType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');
  const [reports, setReports] = useState<ReportedContent[]>([]);
  const [stats, setStats] = useState<ModerationStats>({
    averageResponseTime: '0 hours',
    reportsToday: 0,
    resolutionRate: 0,
    pendingCount: 0,
    flaggedCount: 0,
    rejectedCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, []);

  const fetchReports = async () => {
    try {
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/moderation/reports', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await response.json();
      const formattedReports: ReportedContent[] = data.reports.map((report: ApiReportedContent) => ({
        id: report.id,
        type: report.type as ContentType,
        status: report.status as ContentStatus,
        reportCount: report.reportCount,
        reportedBy: report.reportedBy,
        reportedUser: report.reportedUser,
        content: report.content,
        dateReported: report.dateReported
      }));
      
      setReports(formattedReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/moderation/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleModerationAction = async (reportId: string, action: 'approve' | 'reject') => {
    try {
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/moderation/action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reportId, action })
      });

      if (!response.ok) {
        throw new Error('Failed to perform moderation action');
      }

      const result = await response.json();
      toast.success(result.message);
      
      // Refresh reports and stats
      fetchReports();
      fetchStats();
    } catch (error) {
      console.error('Error performing moderation action:', error);
      toast.error('Failed to perform action');
    }
  };

  const getStatusColor = (status: ContentStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'approved':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-red-500';
      case 'flagged':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: ContentType) => {
    switch (type) {
      case 'plan':
        return <Shield className="h-4 w-4" />;
      case 'comment':
        return <ThumbsDown className="h-4 w-4" />;
      case 'profile':
        return <AlertTriangle className="h-4 w-4" />;
      case 'message':
        return <Flag className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Content Moderation</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            Pending: {stats.pendingCount}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            Flagged: {stats.flaggedCount}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            Rejected: {stats.rejectedCount}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Average Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageResponseTime}</div>
            <p className="text-xs text-muted-foreground">
              Response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Reports Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reportsToday}</div>
            <p className="text-xs text-muted-foreground">
              Reports today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Resolution Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolutionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Resolution rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as ContentType | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Content type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="plan">Plans</SelectItem>
            <SelectItem value="comment">Comments</SelectItem>
            <SelectItem value="profile">Profiles</SelectItem>
            <SelectItem value="message">Messages</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ContentStatus | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reports</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Reported User</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading reports...
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No reports found
                </TableCell>
              </TableRow>
            ) : (
              reports
                .filter(report => {
                  const matchesSearch = report.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      report.reportedUser.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesType = typeFilter === 'all' || report.type === typeFilter;
                  const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
                  return matchesSearch && matchesType && matchesStatus;
                })
                .map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(report.type)}
                    {report.type.charAt(0).toUpperCase() + report.type.slice(1)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <div
                      className={`h-2 w-2 rounded-full mr-2 ${getStatusColor(
                        report.status
                      )}`}
                    />
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </div>
                </TableCell>
                <TableCell>{report.reportCount}</TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {report.content}
                </TableCell>
                <TableCell>{report.reportedUser}</TableCell>
                <TableCell>{report.dateReported}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>View User</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleModerationAction(report.id, 'approve')}>
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleModerationAction(report.id, 'reject')}
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Reject
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}