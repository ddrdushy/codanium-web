// =============================================================================
// AI Team Studio — Team Invitation Email Template
// =============================================================================

import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';
import * as React from 'react';

interface TeamInvitationEmailProps {
  inviterName: string;
  projectName: string;
  role: string;
  acceptUrl: string;
}

export function TeamInvitationEmail({
  inviterName,
  projectName,
  role,
  acceptUrl,
}: TeamInvitationEmailProps) {
  return (
    <EmailLayout preview={`${inviterName} invited you to ${projectName} on AI Team Studio`}>
      <Text style={headingStyle}>You&apos;ve Been Invited!</Text>

      <Text style={textStyle}>
        <strong>{inviterName}</strong> has invited you to join the project{' '}
        <strong>{projectName}</strong> on AI Team Studio.
      </Text>

      <Section style={detailsBoxStyle}>
        <Text style={detailLabelStyle}>Project</Text>
        <Text style={detailValueStyle}>{projectName}</Text>
        <Text style={detailLabelStyle}>Your Role</Text>
        <Text style={detailValueStyle}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
        <Text style={detailLabelStyle}>Invited By</Text>
        <Text style={detailValueStyle}>{inviterName}</Text>
      </Section>

      <Section style={buttonContainerStyle}>
        <Button style={buttonStyle} href={acceptUrl}>
          Accept Invitation
        </Button>
      </Section>

      <Text style={subtextStyle}>
        This invitation expires in 7 days. If you don&apos;t have an account yet,
        you&apos;ll be directed to sign up first.
      </Text>

      <Text style={linkFallbackStyle}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
      </Text>
      <Text style={urlStyle}>{acceptUrl}</Text>
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
