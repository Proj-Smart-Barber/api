import { InMemoryStaffsRepository } from "../../../../../../test/repositories/in-memory-staffs-repository";
import { CPFOrEmailAlreadyInUseError } from "../../_errors/cpf-or-email-already-in-use-error";
import { CreateStaffUseCase } from "./create-staff";

let inMemoryStaffsRepository: InMemoryStaffsRepository;
let sut: CreateStaffUseCase;

describe("Create a new staff", async () => {
  beforeEach(() => {
    inMemoryStaffsRepository = new InMemoryStaffsRepository();
    sut = new CreateStaffUseCase(inMemoryStaffsRepository);
  });

  it("should be able to create a new staff", async () => {
    const response = await sut.execute({
      name: "Fulano",
      email: "fulano@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    expect(response.value).toEqual(
      expect.objectContaining({ staffId: expect.any(String) }),
    );
  });

  it("should not be able to create a staff with an existing email", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    // test

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano1@email.com", // same email
      cpf: "00000000001",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });

  it("should not be able to create a staff with an existing cpf", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    // test

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano2@email.com",
      cpf: "00000000000", // same cpf
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });

  it("should not be able to create a staff with an existing cpf or email", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    // test

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano1@email.com", // same email
      cpf: "00000000000", // same cpf
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });
});
