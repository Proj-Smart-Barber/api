import { faker } from "@faker-js/faker";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { User } from "../../../../enterprise/entities/user";
import { GetUserProfileUseCase } from "./get-user-profile";
import { Password } from "../../../../enterprise/entities/value-objects/password";

let inMemoryUsersRepository: InMemoryUsersRepository;
let sut: GetUserProfileUseCase;

describe("Get user profile", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    sut = new GetUserProfileUseCase(inMemoryUsersRepository);
  });

  it("should be able to get user profile", async () => {
    const newUser = User.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: await Password.generateHashFromPlainText(
        faker.internet.password(),
        12,
      ),
      cpf: faker.phone.number(),
    });

    const createdUser = await inMemoryUsersRepository.save(newUser);

    const result = await sut.execute({ userId: createdUser.id.toString() });

    expect(result.value).toEqual(
      expect.objectContaining({
        user: {
          id: expect.any(String),
          name: expect.any(String),
          avatarUrl: undefined,
          email: expect.any(String),
          phoneNumber: undefined,
          cpf: expect.any(String),
          role: "CLIENT",
          emailVerified: false,
        },
      }),
    );
  });
});
