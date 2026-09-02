import { faker } from "@faker-js/faker";
import { InMemoryStaffsRepository } from "../../../../../../test/repositories/in-memory-staffs-repository";
import { Staff, type StaffRole } from "../../../../enterprise/entities/staff";
import { SignInStaffUseCase } from "./sign-in-staff";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";

let inMemoryStaffsRepository: InMemoryStaffsRepository;
let sut: SignInStaffUseCase;

describe("Sign in staff", async () => {
  beforeEach(() => {
    inMemoryStaffsRepository = new InMemoryStaffsRepository();
    sut = new SignInStaffUseCase(inMemoryStaffsRepository);
  });

  it("should be able to sign in a staff with an email and password", async () => {
    const staffEmail = faker.internet.email();
    const staffPassword = faker.internet.password();
    const hashedStaffPassword = await Password.generateHashFromPlainText(
      staffPassword,
      12,
    );

    const newStaff = Staff.create({
      name: faker.person.fullName(),
      email: staffEmail,
      password: hashedStaffPassword,
      cpf: "12345678901",
      role: "OWNER" as unknown as StaffRole,
    });

    await inMemoryStaffsRepository.save(newStaff);

    const response = await sut.execute({
      email: staffEmail,
      password: staffPassword,
    });

    expect(response.value).toEqual(
      expect.objectContaining({ access_token: expect.any(String) }),
    );
  });

  it("should not be able to sign in a staff with an invalid email", async () => {
    const staffPassword = faker.internet.password();
    const staffEmail = faker.internet.email();

    const newStaff = Staff.create({
      name: faker.person.fullName(),
      email: "wrong@email.com",
      password: Password.create(staffPassword),
      cpf: "09876543211",
      role: "OWNER" as unknown as StaffRole,
    });

    await inMemoryStaffsRepository.save(newStaff);

    const response = await sut.execute({
      email: staffEmail,
      password: staffPassword,
    });

    expect(response.value).toBeInstanceOf(InvalidCredentialsError);
  });

  it("should not be able to sign in a staff with an invalid password", async () => {
    const staffPassword = faker.internet.password();
    const staffEmail = faker.internet.email();

    const newStaff = Staff.create({
      name: faker.person.fullName(),
      email: staffEmail,
      password: Password.create(staffPassword),
      cpf: "09876543211",
      role: "OWNER" as unknown as StaffRole,
    });

    await inMemoryStaffsRepository.save(newStaff);

    const response = await sut.execute({
      email: staffEmail,
      password: "wrong-password",
    });

    expect(response.value).toBeInstanceOf(InvalidCredentialsError);
  });
});
