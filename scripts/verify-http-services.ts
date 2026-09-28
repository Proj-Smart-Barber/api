import app from "../src/app";
import type { Server } from "node:http";

async function run() {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 3334;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    // 1. Auth login
    console.log("1. Testing POST /staffs/sessions/auth...");
    const loginRes = await fetch(`${baseUrl}/staffs/sessions/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "owner@smartbarber.com",
        password: "123456",
      }),
    });
    if (!loginRes.ok) {
      throw new Error(
        `Login failed with status ${loginRes.status}: ${await loginRes.text()}`,
      );
    }
    const loginData = await loginRes.json();
    const token = loginData.access_token || loginData.token;
    if (!token)
      throw new Error("No token returned: " + JSON.stringify(loginData));
    console.log("-> Login OK, token received.");

    // 2. Fetch staff barbershops
    console.log("2. Testing GET /staffs/me/barbershops...");
    const shopsRes = await fetch(`${baseUrl}/staffs/me/barbershops`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!shopsRes.ok) {
      throw new Error(`Fetch shops failed: ${await shopsRes.text()}`);
    }
    const shopsData = await shopsRes.json();
    const barbershop = shopsData.barbershops?.[0];
    if (!barbershop) throw new Error("No barbershop found for owner");
    const shopId = barbershop.id;
    console.log(
      `-> Barbershops OK: Found "${barbershop.name}" (${shopId}) with role "${barbershop.role}".`,
    );

    // 3. List public services
    console.log("3. Testing GET /barbershops/:shopId/services (public)...");
    const listRes = await fetch(`${baseUrl}/barbershops/${shopId}/services`);
    if (!listRes.ok)
      throw new Error(`Public list failed: ${await listRes.text()}`);
    const listData = await listRes.json();
    console.log(`-> Public list OK: Found ${listData.total} services.`);

    // 4. Create service
    console.log("4. Testing POST /barbershops/:shopId/services...");
    const createRes = await fetch(`${baseUrl}/barbershops/${shopId}/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "Barba Terapia Express",
        description: "Toalha quente e massagem facial",
        priceInCents: 3500,
        durationInMinutes: 25,
      }),
    });
    if (!createRes.ok)
      throw new Error(`Create service failed: ${await createRes.text()}`);
    const createdData = await createRes.json();
    const createdService = createdData.service;
    console.log(
      `-> Create service OK: "${createdService.title}" (ID: ${createdService.id}, Price: ${createdService.priceInCents}).`,
    );

    // 5. Get service
    console.log("5. Testing GET /barbershops/:shopId/services/:serviceId...");
    const getRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services/${createdService.id}`,
    );
    if (!getRes.ok)
      throw new Error(`Get service failed: ${await getRes.text()}`);
    const getData = await getRes.json();
    console.log(`-> Get service OK: "${getData.service.title}".`);

    // 6. Update service
    console.log("6. Testing PATCH /barbershops/:shopId/services/:serviceId...");
    const updateRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services/${createdService.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceInCents: 3900,
          durationInMinutes: 30,
        }),
      },
    );
    if (!updateRes.ok)
      throw new Error(`Update service failed: ${await updateRes.text()}`);
    const updateData = await updateRes.json();
    console.log(
      `-> Update service OK: new price ${updateData.service.priceInCents} cents, duration ${updateData.service.durationInMinutes}m.`,
    );

    // 7. Toggle activation (deactivate)
    console.log(
      "7. Testing PATCH /barbershops/:shopId/services/:serviceId/activation...",
    );
    const toggleRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services/${createdService.id}/activation`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: false,
        }),
      },
    );
    if (!toggleRes.ok)
      throw new Error(`Toggle activation failed: ${await toggleRes.text()}`);
    const toggleData = await toggleRes.json();
    console.log(
      `-> Deactivation OK: isActive = ${toggleData.service.isActive}.`,
    );

    // 8. Public list shouldn't show deactivated service
    console.log(
      "8. Testing GET /barbershops/:shopId/services (public should hide inactive)...",
    );
    const listAfterDeactRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services`,
    );
    const listAfterDeact = await listAfterDeactRes.json();
    const hasInactive = listAfterDeact.items.some(
      (s: any) => s.id === createdService.id,
    );
    if (hasInactive)
      throw new Error("Deactivated service was returned in public list!");
    console.log(
      "-> Public list verified: inactive service hidden successfully.",
    );

    // 9. Owner list with includeInactive=true should show it
    console.log(
      "9. Testing GET /barbershops/:shopId/services?includeInactive=true (owner)...",
    );
    const ownerListRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services?includeInactive=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!ownerListRes.ok)
      throw new Error(`Owner list failed: ${await ownerListRes.text()}`);
    const ownerListData = await ownerListRes.json();
    const foundInactive = ownerListData.items.some(
      (s: any) => s.id === createdService.id && !s.isActive,
    );
    if (!foundInactive)
      throw new Error("Owner could not see inactive service!");
    console.log(
      "-> Owner list verified: inactive service present with includeInactive=true.",
    );

    // Re-activate service
    await fetch(
      `${baseUrl}/barbershops/${shopId}/services/${createdService.id}/activation`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: true }),
      },
    );
    console.log("-> Reactivated service successfully.");

    console.log(
      "\nALL BACKEND INTEGRATION HTTP TESTS PASSED AGAINST LIVE DATABASE!",
    );
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error("HTTP verification error:", err);
  process.exit(1);
});
