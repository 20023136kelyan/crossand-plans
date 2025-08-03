import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrophyIcon, UserGroupIcon, CalendarIcon, StarIcon } from '@heroicons/react/24/outline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ActivityScoreCardProps {
  activityScore: number;
  plansCreated: number;
  plansShared: number;
  eventAttendance: number;
  levelTitle: string;
  levelStars: number;
}

export function ActivityScoreCard({
  activityScore,
  plansCreated,
  plansShared,
  eventAttendance,
  levelTitle,
  levelStars,
}: ActivityScoreCardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrophyIcon className="h-5 w-5 text-amber-500" />
          Activity Score
        </CardTitle>
        <CardDescription>Your engagement level and achievements</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Score</span>
              <span className="text-sm font-medium">{activityScore}/100</span>
            </div>
            <Progress value={activityScore} className="h-2" />
          </div>

          {/* Level and Stars */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <h4 className="font-semibold">{levelTitle}</h4>
              <div className="flex items-center mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`h-4 w-4 ${
                      i < levelStars ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-primary">{levelStars}</span>
                    <span className="text-sm text-muted-foreground">/5</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Your current level progress</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xl font-bold">{plansCreated}</div>
              <div className="text-xs text-muted-foreground">Plans Created</div>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <UserGroupIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xl font-bold">{plansShared}</div>
              <div className="text-xs text-muted-foreground">Plans Shared</div>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <TrophyIcon className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-xl font-bold">{eventAttendance}%</div>
              <div className="text-xs text-muted-foreground">Attendance</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 