# AGENTS.md - Kivo Self-Hosted

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

Kivo is an open-source, self-hosted invoicing application built as an npm workspaces monorepo:

- **apps/api** - Cloudflare Workers backend using Hono framework
- **apps/web** - React frontend with Vite, TanStack Router, and shadcn/ui
- **packages/shared** - Shared types, schemas, and utilities

### Single-Tenant Design

Kivo is designed for **one business per deployment**. There is no user authentication, no multi-tenancy, and no shared database. Each deployed instance serves a single business with complete data isolation.

## Build/Lint/Test Commands

### Root Commands (run from project root)
```bash
npm run dev           # Start both API and web dev servers concurrently
npm run dev:api       # Start API dev server only
npm run dev:web       # Start web dev server only
npm run build         # Build all packages (shared → api → web)
npm run test          # Run tests across all workspaces
npm run lint          # ESLint for .ts and .tsx files
npm run typecheck     # TypeScript type checking
```

### API Commands (apps/api)
```bash
npm run dev -w apps/api          # Start Wrangler dev server
npm run build -w apps/api        # Build for Cloudflare Workers
npm run deploy -w apps/api       # Deploy to Cloudflare
npm run test -w apps/api         # Run API tests
npm run db:migrate -w apps/api   # Run D1 migrations (remote)
npm run db:migrate:local -w apps/api  # Run D1 migrations (local)
```

### Web Commands (apps/web)
```bash
npm run dev -w apps/web    # Start Vite dev server
npm run build -w apps/web  # Build for production
npm run lint -w apps/web   # Lint web app
```

### Running a Single Test
```bash
# Run a specific test file
npm run test -w apps/api -- src/durable-objects/reminder-scheduler.test.ts
npm run test -w packages/shared -- src/utils.test.ts

# Run tests matching a pattern
npm run test -w packages/shared -- --grep "calculateInvoiceTotals"

# Run tests in watch mode
npm run test -w packages/shared -- --watch
```

## Code Style Guidelines

### TypeScript Configuration
- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode enabled
- No unused locals/parameters
- No fallthrough in switch statements

### Import Organization
Order imports as follows:
1. External packages (hono, react, zod, etc.)
2. Type imports from external packages
3. Internal package imports (@kivo/shared)
4. Type imports from internal packages
5. Relative imports (local files)
6. Type-only relative imports

```typescript
// Example - API route
import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createClientSchema } from '@kivo/shared';
import type { Client } from '@kivo/shared';
import { ValidationError, NotFoundError } from '../utils/errors';
```

```typescript
// Example - React component
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
```

### Naming Conventions
- **Files**: kebab-case (`error-handler.ts`, `invoice-form.tsx`)
- **Components**: PascalCase (`Button`, `InvoiceForm`)
- **Functions/Variables**: camelCase (`handleResponse`, `clientId`)
- **Constants**: SCREAMING_SNAKE_CASE (`INVOICE_STATUSES`, `API_BASE`)
- **Types/Interfaces**: PascalCase (`Client`, `InvoiceStatus`)
- **Zod Schemas**: camelCase with `Schema` suffix (`clientSchema`, `createInvoiceSchema`)
- **Database fields**: snake_case (`client_id`, `created_at`)

### Type Definitions
Use Zod schemas as the single source of truth. Infer TypeScript types from schemas:

```typescript
// In packages/shared/src/schemas.ts
export const clientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  // ...
});

// In packages/shared/src/types.ts
export type Client = z.infer<typeof clientSchema>;
```

### Error Handling

#### Backend (API)
Use custom error classes extending `AppError`:

```typescript
import { ValidationError, NotFoundError } from '../utils/errors';

// Validation errors
if (!result.success) {
  throw new ValidationError('Invalid input', result.error.flatten());
}

// Not found errors
if (!client) {
  throw new NotFoundError('Client');
}
```

Available error classes:
- `ValidationError` (400)
- `AuthenticationError` (401) — legacy, rarely used
- `AuthorizationError` (403) — legacy, rarely used
- `NotFoundError` (404)
- `ConflictError` (409)
- `RateLimitError` (429)
- `ExternalServiceError` (502)

#### Frontend
Use the `ApiError` class and handle in components:

```typescript
try {
  await clientsApi.create(data);
} catch (error) {
  if (error instanceof ApiError) {
    toast({ title: 'Error', description: error.message, variant: 'destructive' });
  }
}
```

### API Response Format
All API responses follow this structure:

```typescript
// Success response
{ data: T, requestId: string }

// Paginated response
{ data: T[], pagination: { page, limit, total, total_pages }, requestId: string }

// Error response
{ error: { code: string, message: string, details?: unknown }, requestId: string }
```

### Route Handler Pattern
Use JSDoc comments and consistent structure. No `userId` — single-tenant queries operate on the entire database:

```typescript
/**
 * Create a new client
 */
clients.post('/', async (c) => {
  const requestId = c.get('requestId');
  
  const body = await c.req.json();
  const result = createClientSchema.safeParse(body);
  
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.flatten());
  }

  // ... business logic
  
  return c.json({ data: client, requestId }, 201);
});
```

### React Component Pattern
Use forwardRef for UI components, CVA for variants:

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
```

### Testing
Use Vitest with describe/it/expect pattern:

```typescript
import { describe, it, expect } from 'vitest';

describe('calculateInvoiceTotals', () => {
  it('should calculate subtotal correctly', () => {
    const items = [{ quantity: 2, unit_price: 100 }];
    const result = calculateInvoiceTotals(items);
    expect(result.subtotal).toBe(200);
  });
});
```

### Database Queries
Use parameterized queries with D1. No `user_id` filtering needed — each deployment has its own database:

```typescript
const result = await c.env.DB.prepare(
  'SELECT * FROM clients WHERE archived = ?'
).bind(showArchived ? 1 : 0).all<Client>();
```

### Path Aliases
- Frontend: `@/*` maps to `./src/*`
- Use `@kivo/shared` for shared package imports

### Tailwind CSS
- Use `cn()` utility for conditional classes
- Follow shadcn/ui patterns for component styling
- CSS variables for theming (defined in globals.css)

## Architecture Notes

- **Authentication**: None — single-tenant app, anyone with access to the deployed URL can use it. Secure at the deployment level (Cloudflare Access, custom auth proxy, etc.).
- **Database**: Cloudflare D1 (SQLite), one database per deployment
- **Storage**: Cloudflare R2 for PDFs and logos, one bucket per deployment
- **Background Jobs**: Durable Objects for reminder scheduling
- **Payments**: Stripe integration (optional)
- **State Management**: TanStack Query for server state
- **Forms**: react-hook-form with Zod validation
- **Email**: Cloudflare Email Service (`send_email` binding) for transactional email — invoice sending, reminders, receipts. No API keys needed. In local dev, emails are logged to console instead of sent.
- **PDF Generation**: Cloudflare Browser Rendering API with HTML fallback

## Onboarding Architecture

The app has a lightweight onboarding system that guides new business owners through setup:

### API
- `GET /api/onboarding/status` — Returns `business_setup`, `has_clients`, `has_invoices`, `business_name`
- `POST /api/onboarding/test-email` — Diagnostic endpoint to verify email configuration

### Frontend Flow
1. Router (`/`) checks `localStorage` for `kivo.onboarding_complete`
   - Missing → redirects to `/onboarding`
   - Present → redirects to `/dashboard`
2. Onboarding wizard (`/onboarding`): 5 guided steps
   - Step 1: Welcome screen with feature highlights
   - Step 2: Business profile (name, email, address, logo) with live invoice preview
   - Step 3: Invoice preferences (currency, payment terms, prefix)
   - Step 4: First client (optional — can skip)
   - Step 5: Completion screen with CTAs
3. `AppLayout` has an `OnboardingCheck` component that:
   - Reads `localStorage` first (instant, no API call)
   - Falls back to `GET /api/onboarding/status` in background
   - **Never blocks rendering** — children render immediately
   - Redirects to `/onboarding` only if `business_setup === false`
4. Dashboard shows a "Getting Started" checklist for users with no invoices yet, guiding them to add a client and create their first invoice
5. After onboarding completes, calling `markOnboardingComplete()` sets `localStorage` so future visits skip checks entirely

### Design Principles
- **Zero friction**: No auth, no signup forms, no modal dialogs
- **Instant render**: Returning users see content immediately (no loading spinners)
- **Non-technical friendly**: Live invoice preview, plain-language labels, skip options
- **Always escapable**: Every step can be skipped, except business profile which is required for invoices
