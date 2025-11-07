export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // milliseconds
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: Date | null = null;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 3,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 15 * 60 * 1000, // 15 minutes
    };
  }

  canMakeRequest(): boolean {
    if (this.state === 'OPEN') {
      const timeSinceFailure = this.lastFailureTime 
        ? Date.now() - this.lastFailureTime.getTime() 
        : 0;
      
      if (timeSinceFailure > this.config.timeout) {
        console.log('[Circuit Breaker] Transitioning to HALF_OPEN - testing service recovery');
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return true;
      }
      
      console.log('[Circuit Breaker] Circuit is OPEN - blocking request (retry in', 
        Math.round((this.config.timeout - timeSinceFailure) / 1000), 'seconds)');
      return false;
    }
    
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      console.log(`[Circuit Breaker] Success in HALF_OPEN (${this.successCount}/${this.config.successThreshold})`);
      
      if (this.successCount >= this.config.successThreshold) {
        console.log('[Circuit Breaker] Transitioning to CLOSED - service recovered');
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  recordFailure(error?: Error): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    console.log(`[Circuit Breaker] Failure recorded (${this.failureCount}/${this.config.failureThreshold})`, 
      error?.message || '');
    
    if (this.state === 'HALF_OPEN') {
      console.log('[Circuit Breaker] Transitioning back to OPEN - service still failing');
      this.state = 'OPEN';
      this.successCount = 0;
    } else if (this.failureCount >= this.config.failureThreshold) {
      console.log('[Circuit Breaker] Transitioning to OPEN - too many failures');
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    console.log('[Circuit Breaker] Reset to CLOSED state');
  }
}

// Global instance for Gemini API
export const geminiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 15 * 60 * 1000, // 15 minutes
});
