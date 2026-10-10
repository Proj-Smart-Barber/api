import { hashToken } from "../../../../../core/crypto/token";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { FakeEmailService } from "../../../../../../test/fakes/fake-email-service";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryInvitationsRepository } from "../../../../../../test/repositories/in-memory-invitations-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { AlreadyAMemberError } from "../../_errors/already-a-member-error";
import { EmailSendError } from "../../_errors/email-send-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { InviteBarbermanUseCase } from "./invite-barberman";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryInvitationsRepository: InMemoryInvitationsRepository;
let inMemoryMembershipsRepository: InMemoryMembershipsRepository;
let inMemoryUsersRepository: InMemoryUsersRepository;
let fakeEmailService: FakeEmailService;
let sut: InviteBarbermanUseCase;

describe("Invite barberman use case", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryInvitationsRepository = new InMemoryInvitationsRepository();
    inMemoryMembershipsRepository = new InMemoryMembershipsRepository();
    inMemoryUsersRepository = new InMemoryUsersRepository();
    fakeEmailService = new FakeEmailService();

    sut = new InviteBarbermanUseCase(
      inMemoryBarbershopsRepository,
      inMemoryInvitationsRepository,
      inMemoryMembershipsRepository,
      inMemoryUsersRepository,
      fakeEmailService,
    );
  });

  async function createOwner(name = "Carlos Silva") {
    const owner = User.create({
      name,
      email: "owner@example.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
    });
    await inMemoryUsersRepository.save(owner);

    return owner;
  }

  function addBarbershop(
    ownerId: string,
    status: "ACTIVE" | "INACTIVE" = "ACTIVE",
  ) {
    const barbershop = Barbershop.create(
      {
        name: "Barbearia do Carlos",
        ownerId: new UniqueEntityId(ownerId),
        timezone: "America/Sao_Paulo",
        slug: Slug.create("barbearia-do-carlos"),
        cnpj: "12345678901234",
        location: "Rua Teste, 123",
        status,
      },
      new UniqueEntityId("shop-1"),
    );
    inMemoryBarbershopsRepository.items.push(barbershop);

    return barbershop;
  }

  it("should invite a barberman by email and send the invitation email", async () => {
    const owner = await createOwner();
    addBarbershop(owner.id.toString());

    const response = await sut.execute({
      barbershopId: "shop-1",
      userId: owner.id.toString(),
      email: "barberman@example.com",
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.invitedEmail).toBe("barberman@example.com");
      expect(response.value.expiresAt).toBeInstanceOf(Date);
    }

    expect(inMemoryInvitationsRepository.items).toHaveLength(1);
    expect(inMemoryInvitationsRepository.items[0].status).toBe("PENDING");
    expect(inMemoryInvitationsRepository.items[0].role).toBe("BARBERMAN");
    expect(inMemoryInvitationsRepository.items[0].email).toBe(
      "barberman@example.com",
    );

    expect(fakeEmailService.invitationEmails).toHaveLength(1);
    const sent = fakeEmailService.invitationEmails[0];
    expect(sent.to).toBe("barberman@example.com");
    expect(sent.barbershopName).toBe("Barbearia do Carlos");
    expect(sent.ownerName).toBe("Carlos Silva");

    const plainToken = new URL(sent.invitationUrl).searchParams.get("token");
    expect(plainToken).toBeTruthy();
    expect(inMemoryInvitationsRepository.items[0].tokenHash).toBe(
      hashToken(plainToken as string),
    );
  });

  it("should normalize the invited email to lowercase", async () => {
    const owner = await createOwner();
    addBarbershop(owner.id.toString());

    const response = await sut.execute({
      barbershopId: "shop-1",
      userId: owner.id.toString(),
      email: "  BarberMan@Example.COM ",
    });

    expect(response.isRight()).toBe(true);
    expect(inMemoryInvitationsRepository.items[0].email).toBe(
      "barberman@example.com",
    );
    expect(fakeEmailService.invitationEmails[0].to).toBe(
      "barberman@example.com",
    );
  });

  it("should not invite when the requester is not the owner", async () => {
    await createOwner();
    addBarbershop("shop-1");

    const response = await sut.execute({
      barbershopId: "shop-1",
      userId: "other-user",
      email: "barberman@example.com",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(NotAllowedError);
    expect(inMemoryInvitationsRepository.items).toHaveLength(0);
  });

  it("should not invite when the barbershop does not exist", async () => {
    const owner = await createOwner();

    const response = await sut.execute({
      barbershopId: "non-existent-shop",
      userId: owner.id.toString(),
      email: "barberman@example.com",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not invite when the barbershop is inactive", async () => {
    const owner = await createOwner();
    addBarbershop(owner.id.toString(), "INACTIVE");

    const response = await sut.execute({
      barbershopId: "shop-1",
      userId: owner.id.toString(),
      email: "barberman@example.com",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not invite someone who is already a member", async () => {
    const owner = await createOwner();
    addBarbershop(owner.id.toString());

    const barberman = User.create({
      name: "João Souza",
      email: "barberman@example.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "11111111111",
    });
    await inMemoryUsersRepository.save(barberman);

    inMemoryMembershipsRepository.items.push(
      Membership.create({
        role: Role.BARBERMAN,
        barbershopId: new UniqueEntityId("shop-1"),
        userId: barberman.id,
      }),
    );

    const response = await sut.execute({
      barbershopId: "shop-1",
      userId: owner.id.toString(),
      email: "barberman@example.com",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(AlreadyAMemberError);
    expect(inMemoryInvitationsRepository.items).toHaveLength(0);
  });

  it("should not create a duplicate pending invitation for the same email and shop", async () => {
    const owner = await createOwner();
    addBarbershop(owner.id.toString());

    await sut.execute({
      barbershopId: "shop-1",
      userId: owner.id.toString(),
      email: "barberman@example.com",
    });

    const second = await sut.execute({
      barbershopId: "shop-1",
      userId: owner.id.toString(),
      email: "barberman@example.com",
    });

    expect(second.isLeft()).toBe(true);
    expect(inMemoryInvitationsRepository.items).toHaveLength(1);
  });

  it("should return an email send error and rollback the invitation when the email fails", async () => {
    const owner = await createOwner();
    addBarbershop(owner.id.toString());

    fakeEmailService.failNextSend = true;

    const response = await sut.execute({
      barbershopId: "shop-1",
      userId: owner.id.toString(),
      email: "barberman@example.com",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(EmailSendError);
    expect(inMemoryInvitationsRepository.items).toHaveLength(0);
  });
});
