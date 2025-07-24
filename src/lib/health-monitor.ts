/**
 * Application Health Monitoring
 * Provides health checks and basic monitoring for production
 */

import { getSupabaseClient } from './supabase';
import { errorHandler } from './error-handler';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    supabase: boolean;
    clerk: boolean;
    database: boolean;
  };
  responseTime: number;
  errors: string[];
}

class HealthMonitor {
  private static instance: HealthMonitor;
  private lastCheck: HealthStatus | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    const checks = {
      supabase: false,
      clerk: false,
      database: false
    };

    try {
      // Check Supabase client availability
      const supabase = getSupabaseClient();
      checks.supabase = !!supabase;
      if (!supabase) {
        errors.push('Supabase client not available');
      }

      // Check database connectivity
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('id')
            .limit(1);
          
          if (error) {
            errors.push(`Database error: ${error.message}`);
          } else {
            checks.database = true;
          }
        } catch (error) {
          errors.push(`Database connection failed: ${error}`);
        }
      }

      // Check Clerk (basic availability check)
      if (typeof window !== 'undefined' && window.Clerk) {
        checks.clerk = true;
      } else {
        errors.push('Clerk not available');
      }

    } catch (error) {
      errors.push(`Health check failed: ${error}`);
      errorHandler.handleError(error, undefined, { context: 'health_check' });
    }

    const responseTime = Date.now() - startTime;
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (errors.length === 0) {
      status = 'healthy';
    } else if (checks.supabase && checks.database) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date(),
      checks,
      responseTime,
      errors
    };

    this.lastCheck = healthStatus;
    return healthStatus;
  }

  /**
   * Get the last health check result
   */
  public getLastHealthCheck(): HealthStatus | null {
    return this.lastCheck;
  }

  /**
   * Start periodic health monitoring
   */
  public startMonitoring(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);

    // Perform initial check
    this.performHealthCheck();
  }

  /**
   * Stop periodic health monitoring
   */
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check if application is healthy
   */
  public isHealthy(): boolean {
    return this.lastCheck?.status === 'healthy' || false;
  }

  /**
   * Get health metrics for monitoring dashboards
   */
  public getMetrics(): {
    uptime: number;
    lastCheckTime: Date | null;
    errorCount: number;
    averageResponseTime: number;
  } {
    return {
      uptime: performance.now(),
      lastCheckTime: this.lastCheck?.timestamp || null,
      errorCount: this.lastCheck?.errors.length || 0,
      averageResponseTime: this.lastCheck?.responseTime || 0
    };
  }
}

// Export singleton instance
export const healthMonitor = HealthMonitor.getInstance();

// Initialize monitoring in production
if (import.meta.env.PROD) {
  healthMonitor.startMonitoring(300000); // Check every 5 minutes in production
} else if (import.meta.env.DEV) {
  healthMonitor.startMonitoring(60000); // Check every minute in development
}