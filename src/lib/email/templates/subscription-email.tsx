// =============================================================================
// AI Team Studio — Subscription Change Email Template
// =============================================================================

import { Text, Section } from '@react-email/components';
import { EmailLayout } from './layout';
import * as React from 'react';

interface SubscriptionEmailProps {
  name: string;
  plan: string;
  action: string; // 'activated' | 'updated' | 'canceled'
}

export function SubscriptionEmail({
  name,
  plan,
  action,
}: SubscriptionEmailProps) {
  const headings: Record<string, string> = {
    activated: 'Your subscription is active!',
    updated: 'Your subscription has been updated',
    canceled: 'Your subscription has been canceled',
  };

  const messages: Record<string, string> = {
    activated: `Welcome to the ${plan} plan! You now have access to all ${plan}-tier features.`,
    updated: `Your plan has been changed to ${plan}. Your new features are available immediately.`,
    canceled: 'Your subscription has been canceled. You\'ve been moved to the Starter plan with limited features.',
  };

  return (
    <EmailLayout preview={headings[action] ?? 'Subscription update'}>
      <Text style={headingStyle}>
        {headings[action] ?? 'Subscription Update'}
      </Text>

      <Text style={textStyle}>Hi {name},</Text>

      <Text style={textStyle}>
        {messages[action] ?? 'Your subscription has been updated.'}
      </Text>

      <Section style={detailsBoxStyle}>
        <Text style={detailLabelStyle}>Current Plan</Text>
        <Text style={detailValueStyle}>{plan}</Text>
        <Text style={detailLabelStyle}>Status</Text>
        <Text style={detailValueStyle}>
          {action === 'canceled' ? 'Canceled' : 'Active'}
        </Text>
      </Section>

      {action === 'canceled' && (
        <Text style={subtextStyle}>
          You can resubscribe at any time from your billing settings. Your data will
          be preserved on the Starter plan.
        </Text>
      )}

      {action !== 'canceled' && (
        <Text style={subtextStyle}>
          You can manage your subscription and billing details from the billing page
          in your account settings.
        </Text>
      )}
    </EmailLayout>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const headingStyle: React.CSSProperties = {
  color: '#18181b',
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 16px 0',
  letterSpacing: '-0.3px',
};

const textStyle: React.CSSProperties = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
};

const detailsBoxStyle: React.CSSProperties = {
  backgroundColor: '#f9fafb',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  padding: '16px 20px',
  margin: '16px 0',
};

const detailLabelStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 2px 0',
};

const detailValueStyle: React.CSSProperties = {
  color: '#18181b',
  fontSize: '14px',
  fontWeight: 500,
  margin: '0 0 12px 0',
};

const subtextStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '16px 0 0 0',
};
