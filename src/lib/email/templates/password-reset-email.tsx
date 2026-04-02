// =============================================================================
// Codanium — Password Reset Email Template
// =============================================================================

import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';
import * as React from 'react';

interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
}

export function PasswordResetEmail({ name, resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your Codanium password">
      <Text style={headingStyle}>Password Reset Request</Text>

      <Text style={textStyle}>
        Hi {name},
      </Text>

      <Text style={textStyle}>
        We received a request to reset your password for your Codanium
        account. Click the button below to set a new password.
      </Text>

      <Section style={buttonContainerStyle}>
        <Button style={buttonStyle} href={resetUrl}>
          Reset Password
        </Button>
      </Section>

      <Text style={warningStyle}>
        This link expires in 1 hour. After that, you&apos;ll need to request a
        new password reset.
      </Text>

      <Text style={subtextStyle}>
        If you didn&apos;t request a password reset, you can safely ignore this
        email. Your password will remain unchanged.
      </Text>

      <Text style={linkFallbackStyle}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
      </Text>
      <Text style={urlStyle}>{resetUrl}</Text>
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

const warningStyle: React.CSSProperties = {
  color: '#d97706',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '16px 0 8px 0',
  fontWeight: 500,
};

const subtextStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 0 0',
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
