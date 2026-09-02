import { faker } from "@faker-js/faker";
import { InMemoryStaffsRepository } from "../../../../../../test/repositories/in-memory-staffs-repository";
import { Staff, type StaffRole } from "../../../../enterprise/entities/staff";
import { GetStaffProfileUseCase } from "./get-staff-profile";
import { Password } from "../../../../enterprise/entities/value-objects/password";

let inMemoryStaffsRepository: InMemoryStaffsRepository;
let sut: GetStaffProfileUseCase;

describe("Get staff profile", async () => {
  beforeEach(() => {
    inMemoryStaffsRepository = new InMemoryStaffsRepository();
    sut = new GetStaffProfileUseCase(inMemoryStaffsRepository);
  });

  it("should be able to get staff profile", async () => {
    const newStaff = Staff.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: await Password.generateHashFromPlainText(
        faker.internet.password(),
        12,
      ),
      cpf: faker.phone.number(),
      role: "OWNER" as unknown as StaffRole,
    });

    const createdStaff = await inMemoryStaffsRepository.save(newStaff);

    const result = await sut.execute({ staffId: createdStaff.id.toString() });

    expect(result.value).toEqual(
      expect.objectContaining({
        staff: {
          id: expect.any(String),
          name: expect.any(String),
          avatarUrl: undefined,
          email: expect.any(String),
          role: expect.any(String),
        },
      }),
    );
  });
});
