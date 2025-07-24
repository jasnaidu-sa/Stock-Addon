import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabaseAdmin } from '@/lib/supabase';

interface WeekSelection {
  week_reference: string;
  week_start_date: string;
  week_end_date: string;
  is_current: boolean;
  is_active: boolean;
  week_status: string;
}

interface SubmissionReset {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  week_reference: string;
  submission_types: string[];
}

export function SettingsTab() {
  const [weeks, setWeeks] = useState<WeekSelection[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [submissions, setSubmissions] = useState<SubmissionReset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  // Load available weeks
  const loadWeeks = async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('week_selections')
        .select('*')
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      setWeeks(data || []);
    } catch (error) {
      console.error('Error loading weeks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load weeks',
        variant: 'destructive'
      });
    }
  };

  // Load submissions for selected week
  const loadSubmissions = async (weekReference: string) => {
    if (!weekReference) return;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabaseAdmin
        .from('weekly_plan_submissions')
        .select(`
          user_id,
          week_reference,
          submission_type,
          users!inner(first_name, last_name, email, role)
        `)
        .eq('week_reference', weekReference);

      if (error) throw error;

      // Group submissions by user
      const submissionMap = new Map<string, SubmissionReset>();
      
      (data || []).forEach((sub: any) => {
        const userId = sub.user_id;
        const existing = submissionMap.get(userId);
        
        if (existing) {
          existing.submission_types.push(sub.submission_type);
        } else {
          submissionMap.set(userId, {
            user_id: userId,
            first_name: sub.users.first_name,
            last_name: sub.users.last_name,
            email: sub.users.email,
            role: sub.users.role,
            week_reference: weekReference,
            submission_types: [sub.submission_type]
          });
        }
      });

      setSubmissions(Array.from(submissionMap.values()));
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load submissions',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset user submissions
  const resetUserSubmissions = async (userId: string, weekReference: string) => {
    try {
      setIsResetting(true);

      // Delete from weekly_plan_submissions
      const { error: submissionError } = await supabaseAdmin
        .from('weekly_plan_submissions')
        .delete()
        .eq('user_id', userId)
        .eq('week_reference', weekReference);

      if (submissionError) throw submissionError;

      // Reset amendment status back to draft for this user
      const { error: amendmentError } = await supabaseAdmin
        .from('weekly_plan_amendments')
        .update({ amendment_status: 'draft' })
        .eq('amended_by', userId)
        .eq('week_reference', weekReference)
        .in('amendment_status', ['pending', 'submitted']);

      if (amendmentError) {
        console.warn('Error resetting amendment status:', amendmentError);
      }

      toast({
        title: 'Success',
        description: 'User submissions reset successfully',
      });

      // Reload submissions
      await loadSubmissions(weekReference);
    } catch (error) {
      console.error('Error resetting submissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset submissions',
        variant: 'destructive'
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Reset all submissions for week
  const resetAllSubmissions = async (weekReference: string) => {
    try {
      setIsResetting(true);

      // Delete all submissions for the week
      const { error: submissionError } = await supabaseAdmin
        .from('weekly_plan_submissions')
        .delete()
        .eq('week_reference', weekReference);

      if (submissionError) throw submissionError;

      // Reset all amendment statuses back to draft
      const { error: amendmentError } = await supabaseAdmin
        .from('weekly_plan_amendments')
        .update({ amendment_status: 'draft' })
        .eq('week_reference', weekReference)
        .in('amendment_status', ['pending', 'submitted']);

      if (amendmentError) {
        console.warn('Error resetting amendment status:', amendmentError);
      }

      toast({
        title: 'Success',
        description: 'All submissions reset successfully',
      });

      // Reload submissions
      await loadSubmissions(weekReference);
    } catch (error) {
      console.error('Error resetting all submissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset all submissions',
        variant: 'destructive'
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Load weeks on mount
  useEffect(() => {
    loadWeeks();
  }, []);

  // Load submissions when week changes
  useEffect(() => {
    if (selectedWeek) {
      loadSubmissions(selectedWeek);
    }
  }, [selectedWeek]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Reset Amendment Submissions
          </CardTitle>
          <CardDescription>
            Reset user submissions to resolve duplicate constraint errors and allow resubmission
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Select Week:</label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a week to view submissions" />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((week) => (
                    <SelectItem key={week.week_reference} value={week.week_reference}>
                      {week.week_reference} ({new Date(week.week_start_date).toLocaleDateString()} - {new Date(week.week_end_date).toLocaleDateString()})
                      {week.is_current && <Badge variant="default" className="ml-2">Current</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedWeek && (
              <Button 
                onClick={() => loadSubmissions(selectedWeek)} 
                variant="outline"
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
          </div>

          {selectedWeek && submissions.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Submissions for {selectedWeek}</h3>
                <Button 
                  onClick={() => resetAllSubmissions(selectedWeek)}
                  variant="destructive"
                  disabled={isResetting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset All Submissions
                </Button>
              </div>

              <div className="grid gap-4">
                {submissions.map((submission) => (
                  <Card key={submission.user_id} className="border-orange-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="font-medium">
                                {submission.first_name} {submission.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {submission.email}
                              </div>
                            </div>
                            <Badge variant="outline" className="capitalize">
                              {submission.role.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="mt-2 flex gap-2">
                            {submission.submission_types.map((type) => (
                              <Badge key={type} variant="secondary" className="text-xs">
                                {type.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button 
                          onClick={() => resetUserSubmissions(submission.user_id, selectedWeek)}
                          variant="outline"
                          size="sm"
                          disabled={isResetting}
                          className="border-orange-500 text-orange-600 hover:bg-orange-50"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset User
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {selectedWeek && submissions.length === 0 && !isLoading && (
            <Card className="border-gray-200">
              <CardContent className="p-8">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Submissions Found</h3>
                  <p className="text-muted-foreground">
                    No submissions found for week {selectedWeek}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading submissions...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>Additional system configuration options</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-muted-foreground">
            Additional settings functionality coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 