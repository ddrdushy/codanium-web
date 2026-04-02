// =============================================================================
// Codanium — Shared Email Layout
// =============================================================================

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={logoStyle}>Codanium</Text>
          </Section>

          {/* Content */}
          <Section style={contentStyle}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={hrStyle} />
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Codanium — AI-Powered Product Delivery OS
            </Text>
            <Text style={footerSubTextStyle}>
              This is an automated message. Please do not reply directly to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '40px auto',
  maxWidth: '600px',
  padding: '0',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: '#18181b',
  borderRadius: '8px 8px 0 0',
  padding: '24px 32px',
};

const logoStyle: React.CSSProperties = {
  color: '#f59e0b',
  fontSize: '20px',
  fontWeight: 700,
  margin: 0,
  letterSpacing: '-0.5px',
};

const contentStyle: React.CSSProperties = {
  padding: '32px',
};

const hrStyle: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '0',
};

const footerStyle: React.CSSProperties = {
  padding: '20px 32px',
};

const footerTextStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '12px',
  margin: '0 0 4px 0',
};

const footerSubTextStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '11px',
  margin: 0,
};
