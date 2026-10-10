import { renderInvitationEmail } from "./render-invitation-email";

describe("renderInvitationEmail", () => {
  it("renders HTML containing the invitation link and barbershop data", async () => {
    const invitationUrl =
      "https://app.smartbarber.app/invitations/accept?token=abc123";

    const { html, text } = await renderInvitationEmail({
      to: "barberman@email.com",
      ownerName: "Carlos Silva",
      barbershopName: "Barbearia do Carlos",
      invitationUrl,
      expiresInDays: 7,
    });

    expect(html).toContain("Carlos Silva");
    expect(html).toContain("Barbearia do Carlos");
    expect(html).toContain(invitationUrl);
    expect(text).toContain(invitationUrl);
  });
});
