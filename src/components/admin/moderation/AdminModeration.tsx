import { useState } from 'react';
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

const mockReports: ReportedContent[] = [
  {
    id: '1',
    type: 'plan',
    status: 'pending',
    reportCount: 3,
    reportedBy: 'user123',
    reportedUser: 'creator456',
    content: 'Inappropriate plan content...',
    dateReported: '2024-03-15',
  },
  {
    id: '2',
    type: 'comment',
    status: 'flagged',
    reportCount: 5,
    reportedBy: 'user789',
    reportedUser: 'user101',
    content: 'Offensive comment...',
    dateReported: '2024-03-14',
  },
  // Add more mock reports as needed
];

export function AdminModeration() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContentType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');

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
            Pending: 12
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            Flagged: 8
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            Rejected: 5
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
            <div className="text-2xl font-bold">2.5 hours</div>
            <p className="text-xs text-muted-foreground">
              -30min from last week
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
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              +8 from yesterday
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
            <div className="text-2xl font-bold">95%</div>
            <p className="text-xs text-muted-foreground">
              +2% from last week
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
            {mockReports.map((report) => (
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
                      <DropdownMenuItem>
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Reject
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 