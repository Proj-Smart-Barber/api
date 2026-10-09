import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Preview, Section } from "react-email";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

const containerStyle: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px 24px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  backgroundColor: "#ffffff",
  borderRadius: "8px",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "24px",
};

const brandNameStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#111827",
  margin: 0,
};

const footerStyle: React.CSSProperties = {
  marginTop: "28px",
  textAlign: "center",
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "18px",
};

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{ backgroundColor: "#f3f4f6", margin: 0, padding: "24px 0" }}
      >
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <p style={brandNameStyle}>✂️ SmartBarber</p>
          </Section>
          <Section>{children}</Section>
          <Hr style={{ borderColor: "#e5e7eb", margin: "28px 0 16px" }} />
          <Section style={footerStyle}>
            <p style={{ margin: 0 }}>
              Se você não solicitou esta mensagem, pode ignorá-la com segurança.
            </p>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
