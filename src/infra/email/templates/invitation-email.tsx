import type { CSSProperties } from "react";
import { Button, Heading, Text } from "react-email";
import { EmailLayout } from "./email-layout";

interface InvitationEmailProps {
  ownerName: string;
  barbershopName: string;
  invitationUrl: string;
  expiresInDays: number;
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

export function InvitationEmail({
  ownerName,
  barbershopName,
  invitationUrl,
  expiresInDays,
}: InvitationEmailProps) {
  return (
    <EmailLayout
      preview={`${ownerName} te convidou para trabalhar na ${barbershopName}`}
    >
      <Heading style={headingStyle}>Você recebeu um convite!</Heading>
      <Text style={textStyle}>
        <strong>{ownerName}</strong> te convidou para fazer parte da equipe da
        barbearia <strong>{barbershopName}</strong> como barbeiro no
        SmartBarber.
      </Text>
      <Text style={textStyle}>
        Use o botão abaixo para acessar o convite e aceitar ou recusar. O
        convite é válido por {expiresInDays} dia{expiresInDays > 1 ? "s" : ""}.
      </Text>
      <Text style={{ ...textStyle, textAlign: "center", margin: "24px 0" }}>
        <Button style={buttonStyle} href={invitationUrl}>
          Ver convite
        </Button>
      </Text>
      <Text style={textStyle}>
        Se você não esperava por este convite, pode ignorar este e-mail com
        segurança.
      </Text>
    </EmailLayout>
  );
}
