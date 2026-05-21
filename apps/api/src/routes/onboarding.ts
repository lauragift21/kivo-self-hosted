import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { EmailService } from '../services/email';
import { ValidationError } from '../utils/errors';

const onboarding = new Hono<{ Bindings: Env; Variables: Variables }>();

onboarding.use('/*', authMiddleware);

/**
 * Get onboarding status
 *
 * Returns progress indicators so the frontend can guide
 * a new business owner through setup.
 */
onboarding.get('/status', async (c) => {
  const requestId = c.get('requestId');

  const settings = await c.env.DB.prepare(
    'SELECT business_name, business_email, business_address FROM settings LIMIT 1'
  ).first<{ business_name: string | null; business_email: string | null; business_address: string | null }>();

  const clientsResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM clients WHERE archived = 0'
  ).first<{ count: number }>();

  const invoicesResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM invoices'
  ).first<{ count: number }>();

  const businessSetup = !!(
    settings?.business_name &&
    settings?.business_email
  );

  return c.json({
    data: {
      business_setup: businessSetup,
      has_clients: (clientsResult?.count ?? 0) > 0,
      has_invoices: (invoicesResult?.count ?? 0) > 0,
      business_name: settings?.business_name || null,
    },
    requestId,
  });
});

/**
 * Send a test email — diagnostic endpoint for verifying
 * Cloudflare Email Service is configured correctly.
 */
onboarding.post('/test-email', async (c) => {
  const requestId = c.get('requestId');

  const body = await c.req.json<{ to?: string }>();
  const to = body?.to;

  if (!to || !to.includes('@')) {
    throw new ValidationError('Please provide a valid "to" email address');
  }

  const settings = await c.env.DB.prepare(
    'SELECT business_name, email_from_name FROM settings LIMIT 1'
  ).first<{ business_name: string | null; email_from_name: string | null }>();

  const emailService = new EmailService(c.env.EMAIL, c.env.FROM_EMAIL);

  await emailService.sendInvoice(
    to,
    'TEST-001',
    settings?.business_name || 'Kivo',
    0,
    'USD',
    new Date().toISOString(),
    c.env.FRONTEND_URL,
    settings?.email_from_name || undefined
  );

  return c.json({
    data: { message: 'Test email sent successfully', to },
    requestId,
  });
});

export { onboarding };
