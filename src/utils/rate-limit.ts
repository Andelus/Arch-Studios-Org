/**
 * Rate limiting utility for API and service operations
 * Helps protect against brute force attacks and abuse
 */

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum number of requests allowed in the window
  message?: string;      // Optional message to return when rate limited
}

interface RateLimitResult {
  isLimited: boolean;    // Whether the request is rate limited
  remainingRequests: number; // Remaining requests in the current window
  resetTime: number;     // Time when the rate limit window resets (Unix timestamp)
}

// In-memory store for rate limiting
// In production, this would ideally use Redis or another distributed cache
const limitStore: Record<string, { count: number, resetAt: number }> = {};

/**
 * Create a rate limiter with the specified options
 * 
 * @param options Rate limiting configuration
 * @returns Rate limiter functions
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later.' } = options;
  
  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const key in limitStore) {
      if (limitStore[key].resetAt <= now) {
        delete limitStore[key];
      }
    }
  }, Math.min(windowMs, 60000)); // Clean up at least once per minute
  
  /**
   * Check if a key is rate limited
   * 
   * @param key Unique identifier for the entity being rate limited (e.g., user ID, IP address)
   * @returns Whether the request is rate limited and metadata
   */
  async function check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    
    // Initialize or reset expired entry
    if (!limitStore[key] || limitStore[key].resetAt <= now) {
      limitStore[key] = {
        count: 0,
        resetAt: now + windowMs
      };
    }
    
    // Increment counter
    limitStore[key].count += 1;
    
    const isLimited = limitStore[key].count > maxRequests;
    const remainingRequests = Math.max(0, maxRequests - limitStore[key].count);
    const resetTime = limitStore[key].resetAt;
    
    return { isLimited, remainingRequests, resetTime };
  }
  
  /**
   * Middleware-style function to handle rate limiting
   * 
   * @param key Unique identifier for the entity being rate limited
   * @returns A rejected promise if rate limited, otherwise undefined
   */
  async function limit(key: string): Promise<void> {
    const result = await check(key);
    
    if (result.isLimited) {
      const error = new Error(message);
      // Add rate limit metadata to the error object
      (error as any).statusCode = 429;
      (error as any).headers = {
        'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000),
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': result.remainingRequests,
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000)
      };
      throw error;
    }
  }
  
  /**
   * Reset the rate limit counter for a key
   * 
   * @param key Unique identifier to reset
   */
  function reset(key: string): void {
    delete limitStore[key];
  }
  
  return { check, limit, reset };
}
