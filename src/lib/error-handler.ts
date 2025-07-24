/**
 * Production Error Handling System
 * Centralizes error handling, logging, and user notifications
 */

// Error types for categorization
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization', 
  VALIDATION = 'validation',
  NETWORK = 'network',
  DATABASE = 'database',
  UNKNOWN = 'unknown'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Structured error interface
export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  timestamp: Date;
  context?: Record<string, any>;
  stack?: string;
}

// Production-safe error messages
const USER_FRIENDLY_MESSAGES = {
  [ErrorType.AUTHENTICATION]: 'Please sign in to continue.',
  [ErrorType.AUTHORIZATION]: 'You do not have permission to perform this action.',
  [ErrorType.VALIDATION]: 'Please check your input and try again.',
  [ErrorType.NETWORK]: 'Connection issue. Please check your internet and try again.',
  [ErrorType.DATABASE]: 'Service temporarily unavailable. Please try again later.',
  [ErrorType.UNKNOWN]: 'Something went wrong. Please try again.'
};

class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: AppError[] = [];
  private maxErrors = 100; // Keep last 100 errors in memory

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and process errors with appropriate logging and user feedback
   */
  public handleError(
    error: Error | any,
    type: ErrorType = ErrorType.UNKNOWN,
    context?: Record<string, any>
  ): AppError {
    const appError: AppError = {
      id: this.generateErrorId(),
      type,
      severity: this.determineSeverity(type, error),
      message: error?.message || 'Unknown error occurred',
      userMessage: this.getUserMessage(type, error),
      timestamp: new Date(),
      context: this.sanitizeContext(context),
      stack: import.meta.env.DEV ? error?.stack : undefined
    };

    // Store error (keep only recent errors)
    this.errors.unshift(appError);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Log error based on environment
    this.logError(appError);

    return appError;
  }

  /**
   * Handle authentication errors specifically
   */
  public handleAuthError(error: any, context?: Record<string, any>): AppError {
    return this.handleError(error, ErrorType.AUTHENTICATION, context);
  }

  /**
   * Handle database/Supabase errors
   */
  public handleDatabaseError(error: any, context?: Record<string, any>): AppError {
    return this.handleError(error, ErrorType.DATABASE, context);
  }

  /**
   * Handle validation errors
   */
  public handleValidationError(error: any, context?: Record<string, any>): AppError {
    return this.handleError(error, ErrorType.VALIDATION, context);
  }

  /**
   * Handle network errors
   */
  public handleNetworkError(error: any, context?: Record<string, any>): AppError {
    return this.handleError(error, ErrorType.NETWORK, context);
  }

  /**
   * Get recent errors for debugging (admin only)
   */
  public getRecentErrors(limit = 10): AppError[] {
    return this.errors.slice(0, limit);
  }

  /**
   * Clear error history
   */
  public clearErrors(): void {
    this.errors = [];
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine error severity based on type and content
   */
  private determineSeverity(type: ErrorType, error: any): ErrorSeverity {
    switch (type) {
      case ErrorType.AUTHENTICATION:
      case ErrorType.AUTHORIZATION:
        return ErrorSeverity.MEDIUM;
      case ErrorType.DATABASE:
        return ErrorSeverity.HIGH;
      case ErrorType.VALIDATION:
        return ErrorSeverity.LOW;
      case ErrorType.NETWORK:
        return ErrorSeverity.MEDIUM;
      default:
        // Check for specific error patterns
        if (error?.message?.includes('500') || error?.message?.includes('Internal Server Error')) {
          return ErrorSeverity.CRITICAL;
        }
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserMessage(type: ErrorType, error: any): string {
    // Check for specific known errors first
    if (error?.message?.includes('JWT')) {
      return 'Your session has expired. Please sign in again.';
    }
    
    if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
      return USER_FRIENDLY_MESSAGES[ErrorType.NETWORK];
    }

    if (error?.message?.includes('permission') || error?.message?.includes('unauthorized')) {
      return USER_FRIENDLY_MESSAGES[ErrorType.AUTHORIZATION];
    }

    // Default to type-based message
    return USER_FRIENDLY_MESSAGES[type] || USER_FRIENDLY_MESSAGES[ErrorType.UNKNOWN];
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };
    
    // Remove sensitive keys
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'api_key', 'auth'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Log error based on environment and severity
   */
  private logError(appError: AppError): void {
    const logData = {
      id: appError.id,
      type: appError.type,
      severity: appError.severity,
      message: appError.message,
      timestamp: appError.timestamp.toISOString(),
      context: appError.context
    };

    if (import.meta.env.DEV) {
      // Development: Full logging to console
      console.group(`🚨 Error [${appError.severity.toUpperCase()}] - ${appError.type}`);
      console.error('Message:', appError.message);
      console.error('User Message:', appError.userMessage);
      console.error('Context:', appError.context);
      if (appError.stack) {
        console.error('Stack:', appError.stack);
      }
      console.groupEnd();
    } else {
      // Production: Minimal console logging, structured for external monitoring
      if (appError.severity === ErrorSeverity.HIGH || appError.severity === ErrorSeverity.CRITICAL) {
        console.error('[ERROR]', JSON.stringify(logData));
      }
    }

    // In production, you would send errors to external monitoring service
    // this.sendToMonitoringService(appError);
  }

  /**
   * Send errors to external monitoring service (placeholder)
   * In production, integrate with services like Sentry, LogRocket, etc.
   */
  private sendToMonitoringService(appError: AppError): void {
    // TODO: Implement external error monitoring
    // Example: Sentry.captureException(appError);
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Convenience functions
export const handleError = (error: any, type?: ErrorType, context?: Record<string, any>) => 
  errorHandler.handleError(error, type, context);

export const handleAuthError = (error: any, context?: Record<string, any>) => 
  errorHandler.handleAuthError(error, context);

export const handleDatabaseError = (error: any, context?: Record<string, any>) => 
  errorHandler.handleDatabaseError(error, context);

export const handleValidationError = (error: any, context?: Record<string, any>) => 
  errorHandler.handleValidationError(error, context);

export const handleNetworkError = (error: any, context?: Record<string, any>) => 
  errorHandler.handleNetworkError(error, context);