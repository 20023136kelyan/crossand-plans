interface WelcomeEmailTemplateProps {
  firstName: string;
  verificationUrl: string;
}

export function WelcomeEmailTemplate({ firstName, verificationUrl }: WelcomeEmailTemplateProps) {
  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: '#ffffff',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        paddingBottom: '30px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <h1 style={{
          color: '#1f2937',
          fontSize: '28px',
          fontWeight: 'bold',
          margin: '0'
        }}>Welcome to CrossAnd Plans!</h1>
      </div>

      {/* Main Content */}
      <div style={{ padding: '30px 0' }}>
        <h2 style={{
          color: '#374151',
          fontSize: '20px',
          marginBottom: '20px'
        }}>Hi {firstName},</h2>
        
        <p style={{
          color: '#6b7280',
          fontSize: '16px',
          lineHeight: '1.6',
          marginBottom: '20px'
        }}>Thank you for joining CrossAnd Plans! We're excited to have you on board.</p>
        
        <p style={{
          color: '#6b7280',
          fontSize: '16px',
          lineHeight: '1.6',
          marginBottom: '30px'
        }}>To get started and access all features, please verify your email address by clicking the button below:</p>
        
        {/* Verification Button */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <a href={verificationUrl} style={{
            display: 'inline-block',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            padding: '12px 30px',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '600'
          }}>Verify Email Address</a>
        </div>
        
        <p style={{
          color: '#6b7280',
          fontSize: '14px',
          lineHeight: '1.6',
          marginBottom: '20px'
        }}>If the button doesn't work, you can copy and paste this link into your browser:</p>
        
        <p style={{
          color: '#3b82f6',
          fontSize: '14px',
          wordBreak: 'break-all',
          backgroundColor: '#f3f4f6',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '30px'
        }}>{verificationUrl}</p>
        
        <div style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h3 style={{
            color: '#374151',
            fontSize: '16px',
            marginBottom: '15px',
            marginTop: '0'
          }}>What's next?</h3>
          <ul style={{
            color: '#6b7280',
            fontSize: '14px',
            lineHeight: '1.6',
            paddingLeft: '20px',
            margin: '0'
          }}>
            <li style={{ marginBottom: '8px' }}>Complete your profile setup</li>
            <li style={{ marginBottom: '8px' }}>Explore our planning tools</li>
            <li style={{ marginBottom: '8px' }}>Create your first project</li>
            <li>Connect with your team</li>
          </ul>
        </div>
        
        <p style={{
          color: '#6b7280',
          fontSize: '16px',
          lineHeight: '1.6'
        }}>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid #e5e7eb',
        paddingTop: '20px',
        textAlign: 'center'
      }}>
        <p style={{
          color: '#9ca3af',
          fontSize: '12px',
          margin: '0 0 10px 0'
        }}>This email was sent to you because you created an account on CrossAnd Plans.</p>
        
        <p style={{
          color: '#9ca3af',
          fontSize: '12px',
          margin: '0'
        }}>© 2024 CrossAnd Plans. All rights reserved.</p>
      </div>
    </div>
  );
}

// Plain text version for email clients that don't support HTML
export function getWelcomeEmailText(firstName: string, verificationUrl: string): string {
  return `
Welcome to CrossAnd Plans!

Hi ${firstName},

Thank you for joining CrossAnd Plans! We're excited to have you on board.

To get started and access all features, please verify your email address by visiting this link:
${verificationUrl}

What's next?
- Complete your profile setup
- Explore our planning tools
- Create your first project
- Connect with your team

If you have any questions or need help getting started, don't hesitate to reach out to our support team.

Best regards,
The CrossAnd Plans Team

© 2024 CrossAnd Plans. All rights reserved.
  `.trim();
}