// =============================================================================
// Codanium — Email Verification Template
// =============================================================================

import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';
import * as React from 'react';

interface VerificationEmailProps {
  name: string;
  verificationUrl: string;
}

export function VerificationEmail({ name, verificationUrl }: VerificationEmailProps) {
  return (
    <EmailLayout preview="Verify your email address for Codanium">
      <Text style={headingStyle}>Welcome to Codanium</Text>

      <Text style={textStyle}>
        Hi {name},
      </Text>

      <Text style={textStyle}>
        Thanks for creating your account! Please verify your email address by
        clicking the button below.
      </Text>

      <Section style={buttonContainerStyle}>
        <Button style={buttonStyle} href={verificationUrl}>
          Verify Email Address
        </Button>
      </Section>

      <Text style={subtextStyle}>
        This link expires in 24 hours. If you didn&apos;t create an account with
        Codanium, you can safely ignore this email.
      </Text>

      <Text style={linkFallbackStyle}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
      </Text>
      <Text style={urlStyle}>{verificationUrl}</Text>
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
  backgroundColor: '#f59e0b',
  borderRadius: '6px',
  color: '#18181b',
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
