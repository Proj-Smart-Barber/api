import type { CSSProperties } from "react";
import { Button, Heading, Text } from "react-email";
import { EmailLayout } from "./email-layout";

interface VerificationEmailProps {
  name: string;
  verificationUrl: string;
  expiresInHours: number;
}

const headingStyle: CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#111827",
  margin: "0 0 12px",
};

const textStyle: CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  margin: "0 0 16px",
};

const buttonStyle: CSSProperties = {
  display: "inline-block",
  backgroundColor: "#0EACE8",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
};

export function VerificationEmail({
  name,
  verificationUrl,
  expiresInHours,
}: VerificationEmailProps) {
  return (
    <EmailLayout preview="Confirme seu e-mail para ativar sua conta no SmartBarber">
      <Heading style={headingStyle}>Olá, {name}!</Heading>
      <Text style={textStyle}>
        Obrigado por criar sua conta no SmartBarber. Para ativar sua conta, use
        o botão abaixo para confirmar seu e-mail. O link é válido por{" "}
        {expiresInHours} hora{expiresInHours > 1 ? "s" : ""}.
      </Text>
      <Text style={{ ...textStyle, textAlign: "center", margin: "24px 0" }}>
        <Button style={buttonStyle} href={verificationUrl}>
          Confirmar e-mail
        </Button>
      </Text>
      <Text style={textStyle}>
        Se você não criou uma conta no SmartBarber, ignore este e-mail.
      </Text>
    </EmailLayout>
  );
}
