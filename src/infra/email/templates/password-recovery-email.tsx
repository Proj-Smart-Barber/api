import type { CSSProperties } from "react";
import { Button, Heading, Text } from "react-email";
import { EmailLayout } from "./email-layout";

interface PasswordRecoveryEmailProps {
  name: string;
  recoveryUrl: string;
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

export function PasswordRecoveryEmail({
  name,
  recoveryUrl,
  expiresInHours,
}: PasswordRecoveryEmailProps) {
  return (
    <EmailLayout preview="Redefina sua senha no SmartBarber">
      <Heading style={headingStyle}>Olá, {name}!</Heading>
      <Text style={textStyle}>
        Recebemos uma solicitação para redefinir a senha da sua conta no
        SmartBarber. Para criar uma nova senha, use o botão abaixo. O link é
        válido por {expiresInHours} hora{expiresInHours > 1 ? "s" : ""}.
      </Text>
      <Text style={{ ...textStyle, textAlign: "center", margin: "24px 0" }}>
        <Button style={buttonStyle} href={recoveryUrl}>
          Redefinir senha
        </Button>
      </Text>
      <Text style={textStyle}>
        Se você não solicitou a redefinição de senha, pode ignorar este e-mail.
      </Text>
    </EmailLayout>
  );
}
