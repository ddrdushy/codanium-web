// =============================================================================
// Codanium — Payment Failed Email Template
// =============================================================================

import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';
import * as React from 'react';

interface PaymentFailedEmailProps {
  name: string;
  amount: string;
  updateUrl: string;
}

export function PaymentFailedEmail({
  name,
  amount,
  updateUrl,
}: PaymentFailedEmailProps) {
  return (
    <EmailLayout preview="Your payment failed — please update your payment method">
      <Text style={headingStyle}>Payment Failed</Text>

      <Text style={textStyle}>Hi {name},</Text>

      <Text style={textStyle}>
        We were unable to process your payment of <strong>${amount}</strong> for
        your Codanium subscription.
      </Text>

      <Section style={warningBoxStyle}>
        <Text style={warningTextStyle}>
          Your subscription is at risk of being canceled. Please update your
          payment method to avoid losing access to your plan features.
        </Text>
      </Section>

      <Section style={buttonContainerStyle}>
        <Button style={buttonStyle} href={updateUrl}>
          Update Payment Method
        </Button>
      </Section>

      <Text style={subtextStyle}>
        If you believe this is an error, please check with your bank or card
        issuer. If you need assistance, reply to this email.
      </Text>

      <Text style={linkFallbackStyle}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
      </Text>
      <Text style={urlStyle}>{updateUrl}</Text>
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

const warningBoxStyle: React.CSSProperties = {
  backgroundColor: '#fef3c7',
  borderRadius: '6px',
  border: '1px solid #fbbf24',
  padding: '16px 20px',
  margin: '16px 0',
};

const warningTextStyle: React.CSSProperties = {
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '22px',
  margin: 0,
  fontWeight: 500,
};

const buttonContainerStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#ef4444',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 600,
  padding: '12px 32px',
  textDecoration: 'none',
};

const subtextStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '16px 0 0 0',
};

const linkFallbackStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '16px 0 4px 0',
};

const urlStyle: React.CSSProperties = {
  color: '#3b82f6',
  fontSize: '12px',
  wordBreak: 'break-all' as const,
  margin: 0,
};
