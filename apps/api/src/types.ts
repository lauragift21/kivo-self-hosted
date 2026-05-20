import type { Context } from 'hono';

export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  REMINDER_SCHEDULER: DurableObjectNamespace;
  ASSETS: Fetcher;
  EMAIL: SendEmail;

  // Environment variables
  ENVIRONMENT: string;
  FRONTEND_URL: string;
  API_URL: string;
  FROM_EMAIL: string;

  // Secrets (set via wrangler secret)
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;

  // Cloudflare Browser Rendering
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

export interface Variables {
  requestId: string;
}

export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export interface SendEmail {
  send(options: {
    to: string;
    from: { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ ok: boolean }>;
}

export interface RateLimitState {
  count: number;
  reset_at: number;
}

export interface StructuredLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  requestId?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}
