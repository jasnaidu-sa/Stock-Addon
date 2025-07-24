import { Calendar, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWeekManagement, type WeekSelection, getWeekInfo, canUserAccessWeek } from '@/hooks/use-week-management';

interface WeekSelectorProps {
  userRole: string;
  selectedWeekId?: string;
  onWeekSelect?: (week: WeekSelection) => void;
  showOnlyActive?: boolean;
  showCurrentWeekInfo?: boolean;
  className?: string;
}

export function WeekSelector({
  userRole,
  selectedWeekId,
  onWeekSelect,
  showOnlyActive = true,
  showCurrentWeekInfo = true,
  className = ''
}: WeekSelectorProps) {
  const { weeks, currentWeek, activeWeeks, isLoading, error } = useWeekManagement();

  const availableWeeks = showOnlyActive ? activeWeeks : weeks;
  const accessibleWeeks = availableWeeks.filter(week => canUserAccessWeek(week, userRole));

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Clock className="mx-auto h-8 w-8 text-gray-400 animate-spin" />
              <p className="mt-2 text-sm text-gray-500">Loading weeks...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load week selections: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Current Week Info */}
      {showCurrentWeekInfo && currentWeek && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Current Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-green-100 text-green-800">
                {currentWeek.week_reference}
              </Badge>
              <span className="text-sm text-gray-600">
                {getWeekInfo(currentWeek).dateRange}
              </span>
              {!currentWeek.is_active && (
                <Badge variant="destructive" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>
            {!canUserAccessWeek(currentWeek, userRole) && (
              <Alert className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You don't have access to make amendments in the current week.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Week Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {onWeekSelect ? 'Select Week' : 'Available Weeks'}
          </CardTitle>
          <CardDescription>
            {onWeekSelect 
              ? 'Choose a week to work on amendments' 
              : 'Weeks available for amendments'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accessibleWeeks.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No weeks are currently available for amendments.
                {userRole === 'admin' && ' Use the Week Management section to activate weeks.'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {accessibleWeeks.map((week) => {
                const weekInfo = getWeekInfo(week);
                const isSelected = selectedWeekId === week.id;
                
                return (
                  <div
                    key={week.id}
                    className={`
                      flex items-center justify-between p-3 border rounded-lg transition-colors
                      ${isSelected 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{week.week_reference}</span>
                        {week.is_current && (
                          <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {weekInfo.dateRange}
                      </div>
                    </div>
                    
                    {onWeekSelect && (
                      <Button
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => onWeekSelect(week)}
                        disabled={!canUserAccessWeek(week, userRole)}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}