/**
 * Request Validation and Rate Limiting
 * Provides client-side validation and basic rate limiting
 */

import { z } from 'zod';
import { handleValidationError } from './error-handler';

// Rate limiting configuration
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

// Default rate limits
const DEFAULT_RATE_LIMITS = {
  login: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  orders: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  general: { maxRequests: 1000, windowMs: 60 * 1000 }, // 1000 requests per minute
};

// Track requests by endpoint and user
const requestTracker = new Map<string, { count: number; resetTime: number }>();

class RequestValidator {
  private static instance: RequestValidator;

  private constructor() {}

  public static getInstance(): RequestValidator {
    if (!RequestValidator.instance) {
      RequestValidator.instance = new RequestValidator();
    }
    return RequestValidator.instance;
  }

  /**
   * Check if request is within rate limits
   */
  public checkRateLimit(
    endpoint: string,
    userId: string = 'anonymous',
    config?: RateLimitConfig
  ): { allowed: boolean; resetTime?: number; remaining?: number } {
    const key = `${endpoint}:${userId}`;
    const now = Date.now();
    
    // Get rate limit config
    const rateLimitConfig = config || this.getDefaultRateLimit(endpoint);
    
    // Get or create tracking entry
    let tracker = requestTracker.get(key);
    
    if (!tracker || now > tracker.resetTime) {
      // Reset or create new tracker
      tracker = {
        count: 0,
        resetTime: now + rateLimitConfig.windowMs
      };
      requestTracker.set(key, tracker);
    }

    // Check if limit exceeded
    if (tracker.count >= rateLimitConfig.maxRequests) {
      return {
        allowed: false,
        resetTime: tracker.resetTime,
        remaining: 0
      };
    }

    // Increment counter
    tracker.count++;
    
    return {
      allowed: true,
      resetTime: tracker.resetTime,
      remaining: rateLimitConfig.maxRequests - tracker.count
    };
  }

  /**
   * Validate order data
   */
  public validateOrder(orderData: any): { valid: boolean; errors?: string[] } {
    const orderSchema = z.object({
      store_name: z.string().min(1, 'Store name is required').max(100, 'Store name too long'),
      customer_name: z.string().min(1, 'Customer name is required').max(100, 'Customer name too long'),
      customer_email: z.string().email('Invalid email format').optional().or(z.literal('')),
      customer_phone: z.string().optional(),
      description: z.string().max(500, 'Description too long').optional(),
      notes: z.string().max(1000, 'Notes too long').optional(),
      items: z.array(z.object({
        product_code: z.string().min(1, 'Product code is required'),
        quantity: z.number().min(1, 'Quantity must be at least 1').max(100, 'Quantity too large'),
        price: z.number().min(0, 'Price must be non-negative'),
        notes: z.string().max(200, 'Item notes too long').optional()
      })).min(1, 'At least one item is required')
    });

    try {
      orderSchema.parse(orderData);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
      return { valid: false, errors: ['Invalid order data'] };
    }
  }

  /**
   * Validate user data
   */
  public validateUser(userData: any): { valid: boolean; errors?: string[] } {
    const userSchema = z.object({
      email: z.string().email('Invalid email format'),
      name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
      role: z.enum(['admin', 'user'], { errorMap: () => ({ message: 'Role must be admin or user' }) }),
      company_name: z.string().max(100, 'Company name too long').optional(),
      status: z.enum(['active', 'pending', 'suspended']).optional()
    });

    try {
      userSchema.parse(userData);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
      return { valid: false, errors: ['Invalid user data'] };
    }
  }

  /**
   * Sanitize input to prevent XSS
   */
  public sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }

  /**
   * Validate and sanitize form data
   */
  public processFormData(formData: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(formData)) {
      if (typeof value === 'string') {
        processed[key] = this.sanitizeInput(value);
      } else if (typeof value === 'number') {
        processed[key] = value;
      } else if (Array.isArray(value)) {
        processed[key] = value.map(item => 
          typeof item === 'string' ? this.sanitizeInput(item) : item
        );
      } else {
        processed[key] = value;
      }
    }
    
    return processed;
  }

  /**
   * Get default rate limit for endpoint
   */
  private getDefaultRateLimit(endpoint: string): RateLimitConfig {
    if (endpoint.includes('login') || endpoint.includes('auth')) {
      return DEFAULT_RATE_LIMITS.login;
    }
    if (endpoint.includes('order')) {
      return DEFAULT_RATE_LIMITS.orders;
    }
    return DEFAULT_RATE_LIMITS.general;
  }

  /**
   * Clear rate limit tracking (for testing or admin reset)
   */
  public clearRateLimits(): void {
    requestTracker.clear();
  }
}

// Export singleton instance
export const requestValidator = RequestValidator.getInstance();

// Convenience functions
export const checkRateLimit = (endpoint: string, userId?: string, config?: RateLimitConfig) =>
  requestValidator.checkRateLimit(endpoint, userId, config);

export const validateOrder = (orderData: any) =>
  requestValidator.validateOrder(orderData);

export const validateUser = (userData: any) =>
  requestValidator.validateUser(userData);

export const sanitizeInput = (input: string) =>
  requestValidator.sanitizeInput(input);

export const processFormData = (formData: Record<string, any>) =>
  requestValidator.processFormData(formData);

// Rate limit decorator for API calls
export function withRateLimit(endpoint: string, config?: RateLimitConfig) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const userId = 'current_user'; // Should be replaced with actual user ID
      const rateCheck = checkRateLimit(endpoint, userId, config);
      
      if (!rateCheck.allowed) {
        const resetTime = new Date(rateCheck.resetTime || 0);
        const error = new Error(`Rate limit exceeded. Try again after ${resetTime.toLocaleTimeString()}`);
        handleValidationError(error, { endpoint, userId, rateCheck });
        throw error;
      }
      
      return method.apply(this, args);
    };
  };
}