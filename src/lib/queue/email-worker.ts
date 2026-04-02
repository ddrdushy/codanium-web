// =============================================================================
// Codanium — Email Worker (BullMQ)
// =============================================================================
// Processes email jobs by rendering React Email templates to HTML and sending
// via the email service (Mailjet or console fallback).
//
// Mirrors orchestration-worker.ts pattern.
// =============================================================================

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from './connection';
import { EMAIL_QUEUE_NAME } from './email-queue';
import type { EmailJobData } from './email-queue';
import { render } from '@react-email/components';
import { sendEmail } from '@/lib/email';

// Template imports (React Email components)
import { VerificationEmail } from '@/lib/email/templates/verification-email';
import { PasswordResetEmail } from '@/lib/email/templates/password-reset-email';
import { TeamInvitationEmail } from '@/lib/email/templates/team-invitation-email';
import { SubscriptionEmail } from '@/lib/email/templates/subscription-email';
import { PaymentFailedEmail } from '@/lib/email/templates/payment-failed-email';

// ---------------------------------------------------------------------------
// Worker Singleton
// ---------------------------------------------------------------------------

let _worker: Worker<EmailJobData> | null = null;

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

/**
 * Process a single email job. Renders template to HTML and sends via SendGrid.
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, template, props } = job.data;

  console.log(`[EmailWorker] Processing job ${job.id}: ${template} → ${to}`);

  // Render the appropriate template to HTML
  let html: string;

  switch (template) {
    case 'verification':
      html = await render(
        VerificationEmail({
          name: props.name ?? 'there',
          verificationUrl: props.verificationUrl ?? '',
        }),
      );
      break;

    case 'password-reset':
      html = await render(
        PasswordResetEmail({
          name: props.name ?? 'there',
          resetUrl: props.resetUrl ?? '',
        }),
      );
      break;

    case 'team-invitation':
      html = await render(
        TeamInvitationEmail({
          inviterName: props.inviterName ?? 'Someone',
          projectName: props.projectName ?? 'a project',
          role: props.role ?? 'member',
          acceptUrl: props.acceptUrl ?? '',
        }),
      );
      break;

    case 'subscription':
      html = await render(
        SubscriptionEmail({
          name: props.name ?? 'there',
          plan: props.plan ?? 'Starter',
          action: props.action ?? 'updated',
        }),
      );
      break;

    case 'payment-failed':
      html = await render(
        PaymentFailedEmail({
          name: props.name ?? 'there',
          amount: props.amount ?? '0',
          updateUrl: props.updateUrl ?? '',
        }),
      );
      break;

    default:
      throw new Error(`Unknown email template: ${template}`);
  }

  // Send the email with customId for Mailjet event correlation
  const customId = `job-${job.id}`;
  const success = await sendEmail({ to, subject, html, customId });

  if (!success) {
    throw new Error(`Failed to send email to ${to}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create and start the BullMQ email worker.
 * Call once from worker-entrypoint.ts.
 */
export function createEmailWorker(): Worker<EmailJobData> {
  if (_worker) return _worker;

  _worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: getQueueConnection(),
      concurrency: 3, // 3 concurrent email sends
      limiter: {
        max: 5,
        duration: 1000, // Max 5 emails per second (Mailjet rate limit)
      },
    },
  );

  // ── Event Handlers ──────────────────────────────────────────────────────

  _worker.on('failed', (job, err) => {
    if (!job) return;
    console.error(
      `[EmailWorker] Job ${job.id} failed (attempt ${job.attemptsMade}):`,
      err.message,
    );
  });

  _worker.on('completed', (job) => {
    console.log(
      `[EmailWorker] Job ${job?.id} completed: ${job?.data.template} → ${job?.data.to}`,
    );
  });

  _worker.on('error', (err) => {
    console.error('[EmailWorker] Worker error:', err);
  });

  return _worker;
}
