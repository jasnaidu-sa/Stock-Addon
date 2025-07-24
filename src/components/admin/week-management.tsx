import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Calendar, Clock, Settings, Users, CheckCircle, XCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabaseAdmin } from '@/lib/supabase';

interface WeekSelection {
  id: string;
  week_reference: string;
  week_start_date: string;
  week_end_date: string;
  year: number;
  week_number: number;
  is_current: boolean;
  is_active: boolean;
  created_at: string;
}

const weekSchema = z.object({
  week_reference: z.string().min(1, "Week reference is required"),
  week_start_date: z.string().min(1, "Start date is required"),
  week_end_date: z.string().min(1, "End date is required"),
  year: z.number().min(2024).max(2030),
  week_number: z.number().min(1).max(53),
  is_active: z.boolean().default(true)
});

type WeekFormData = z.infer<typeof weekSchema>;

export function WeekManagement() {
  const [weeks, setWeeks] = useState<WeekSelection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  const checkSupabase = () => {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }
    return supabaseAdmin;
  };

  const form = useForm<WeekFormData>({
    resolver: zodResolver(weekSchema),
    defaultValues: {
      is_active: true
    }
  });

  const fetchWeeks = async () => {
    try {
      setIsLoading(true);
      const db = checkSupabase();
      
      const { data, error } = await db
        .from('week_selections')
        .select('*')
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      
      setWeeks(data || []);
    } catch (error) {
      console.error('Error fetching weeks:', error);
      toast({
        title: "Error",
        description: "Failed to load week selections",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeks();
  }, []);

  const handleSetCurrentWeek = async (weekId: string) => {
    try {
      const db = checkSupabase();
      
      // First, set all weeks to not current
      await db
        .from('week_selections')
        .update({ is_current: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
      
      // Then set the selected week as current
      const { error } = await db
        .from('week_selections')
        .update({ is_current: true })
        .eq('id', weekId);

      if (error) throw error;
      
      await fetchWeeks();
      toast({
        title: "Success",
        description: "Current week updated successfully",
      });
    } catch (error) {
      console.error('Error setting current week:', error);
      toast({
        title: "Error",
        description: "Failed to set current week",
        variant: "destructive"
      });
    }
  };

  const handleToggleActive = async (weekId: string, isActive: boolean) => {
    try {
      const db = checkSupabase();
      
      const { error } = await db
        .from('week_selections')
        .update({ is_active: isActive })
        .eq('id', weekId);

      if (error) throw error;
      
      await fetchWeeks();
      toast({
        title: "Success",
        description: `Week ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling week active status:', error);
      toast({
        title: "Error",
        description: "Failed to update week status",
        variant: "destructive"
      });
    }
  };

  const onSubmit = async (data: WeekFormData) => {
    try {
      const db = checkSupabase();
      
      const { error } = await db
        .from('week_selections')
        .insert([data]);

      if (error) throw error;
      
      await fetchWeeks();
      form.reset();
      setShowAddForm(false);
      toast({
        title: "Success",
        description: "Week added successfully",
      });
    } catch (error) {
      console.error('Error adding week:', error);
      toast({
        title: "Error",
        description: "Failed to add week",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Week Management</h2>
          <p className="text-gray-600 mt-1">
            Manage week selections and control when amendments are available
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus size={16} />
          Add Week
        </Button>
      </div>

      {/* Add Week Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Week</CardTitle>
            <CardDescription>
              Create a new week selection for amendment management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="week_reference">Week Reference</Label>
                  <Input
                    id="week_reference"
                    placeholder="Week 32"
                    {...form.register('week_reference')}
                  />
                  {form.formState.errors.week_reference && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.week_reference.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="week_number">Week Number</Label>
                  <Input
                    id="week_number"
                    type="number"
                    min="1"
                    max="53"
                    {...form.register('week_number', { valueAsNumber: true })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="week_start_date">Start Date</Label>
                  <Input
                    id="week_start_date"
                    type="date"
                    {...form.register('week_start_date')}
                  />
                </div>
                <div>
                  <Label htmlFor="week_end_date">End Date</Label>
                  <Input
                    id="week_end_date"
                    type="date"
                    {...form.register('week_end_date')}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min="2024"
                  max="2030"
                  {...form.register('year', { valueAsNumber: true })}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={form.watch('is_active')}
                  onCheckedChange={(checked) => form.setValue('is_active', checked)}
                />
                <Label htmlFor="is_active">Active (available for amendments)</Label>
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  Add Week
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Current Week Status */}
      {weeks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={20} />
              Current Week Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeks.find(w => w.is_current) ? (
              <div className="flex items-center gap-3">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Current Week
                </Badge>
                <span className="font-semibold">
                  {weeks.find(w => w.is_current)?.week_reference}
                </span>
                <span className="text-gray-600">
                  {formatDate(weeks.find(w => w.is_current)?.week_start_date || '')} - 
                  {formatDate(weeks.find(w => w.is_current)?.week_end_date || '')}
                </span>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No current week is set. Select a week to designate as current.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Weeks List */}
      <Card>
        <CardHeader>
          <CardTitle>Week Selections</CardTitle>
          <CardDescription>
            Manage available weeks for amendment submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading weeks...</div>
          ) : weeks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No weeks available. Add a week to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {weeks.map((week) => (
                <div 
                  key={week.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span className="font-semibold">{week.week_reference}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDate(week.week_start_date)} - {formatDate(week.week_end_date)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Year {week.year}, Week {week.week_number}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {week.is_current && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Current
                      </Badge>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={week.is_active}
                        onCheckedChange={(checked) => handleToggleActive(week.id, checked)}
                      />
                      <span className="text-sm">
                        {week.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    {!week.is_current && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleSetCurrentWeek(week.id)}
                      >
                        Set as Current
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}