import { describe, it, expect, beforeEach } from "vitest";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";
import { InMemoryReviewsRepository } from "../../../../../test/repositories/in-memory-reviews-repository";
import { InMemoryBookingsRepository } from "../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryBarbershopsRepository } from "../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryMembershipsRepository } from "../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../test/repositories/in-memory-users-repository";
import { Booking } from "../../../enterprise/entities/booking";
import { BookingServiceItem } from "../../../enterprise/entities/booking-service-item";
import { Barbershop } from "../../../enterprise/entities/barbershop";
import { Membership, Role } from "../../../enterprise/entities/membership";
import { User } from "../../../enterprise/entities/user";
import { Password } from "../../../enterprise/entities/value-objects/password";
import { CreateReviewUseCase } from "./create-review/create-review";
import { UpdateReviewUseCase } from "./update-review/update-review";
import { DeleteReviewUseCase } from "./delete-review/delete-review";
import { GetBookingReviewUseCase } from "./get-booking-review/get-booking-review";
import { ListBarbershopReviewsUseCase } from "./list-barbershop-reviews/list-barbershop-reviews";
import { ListTargetReviewsUseCase } from "./list-target-reviews/list-target-reviews";
import { ReportReviewUseCase } from "./report-review/report-review";
import { ModerateReviewUseCase } from "./moderate-review/moderate-review";

describe("Reviews & Moderation Use Cases", () => {
  let reviewsRepository: InMemoryReviewsRepository;
  let bookingsRepository: InMemoryBookingsRepository;
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let membershipsRepository: InMemoryMembershipsRepository;
  let usersRepository: InMemoryUsersRepository;

  let createReviewUseCase: CreateReviewUseCase;
  let updateReviewUseCase: UpdateReviewUseCase;
  let deleteReviewUseCase: DeleteReviewUseCase;
  let getBookingReviewUseCase: GetBookingReviewUseCase;
  let listBarbershopReviewsUseCase: ListBarbershopReviewsUseCase;
  let listTargetReviewsUseCase: ListTargetReviewsUseCase;
  let reportReviewUseCase: ReportReviewUseCase;
  let moderateReviewUseCase: ModerateReviewUseCase;

  const clientId = "11111111-1111-1111-1111-111111111111";
  const ownerId = "22222222-2222-2222-2222-222222222222";
  const staffId = "33333333-3333-3333-3333-333333333333";
  const adminId = "44444444-4444-4444-4444-444444444444";
  const barbershopId = "55555555-5555-5555-5555-555555555555";
  const bookingId = "66666666-6666-6666-6666-666666666666";

  beforeEach(async () => {
    reviewsRepository = new InMemoryReviewsRepository();
    bookingsRepository = new InMemoryBookingsRepository();
    barbershopsRepository = new InMemoryBarbershopsRepository();
    membershipsRepository = new InMemoryMembershipsRepository();
    usersRepository = new InMemoryUsersRepository();

    createReviewUseCase = new CreateReviewUseCase(
      reviewsRepository,
      bookingsRepository,
      barbershopsRepository,
      membershipsRepository,
    );
    updateReviewUseCase = new UpdateReviewUseCase(
      reviewsRepository,
      barbershopsRepository,
      bookingsRepository,
    );
    deleteReviewUseCase = new DeleteReviewUseCase(
      reviewsRepository,
      barbershopsRepository,
    );
    getBookingReviewUseCase = new GetBookingReviewUseCase(reviewsRepository);
    listBarbershopReviewsUseCase = new ListBarbershopReviewsUseCase(
      reviewsRepository,
      usersRepository,
    );
    listTargetReviewsUseCase = new ListTargetReviewsUseCase(
      reviewsRepository,
      usersRepository,
      barbershopsRepository,
    );
    reportReviewUseCase = new ReportReviewUseCase(reviewsRepository);
    moderateReviewUseCase = new ModerateReviewUseCase(
      reviewsRepository,
      usersRepository,
      barbershopsRepository,
    );

    // Setup base users
    const clientUser = User.create(
      {
        name: "Cliente Teste",
        email: "client@example.com",
        cpf: "11122233344",
        accountType: "CLIENT",
        password: Password.create("hashed_pw"),
      },
      new UniqueEntityId(clientId),
    );
    await usersRepository.save(clientUser);

    const adminUser = User.create(
      {
        name: "Admin Plataforma",
        email: "admin@smartbarber.com",
        cpf: "99988877766",
        accountType: "PLATFORM_ADMIN",
        password: Password.create("hashed_pw"),
      },
      new UniqueEntityId(adminId),
    );
    await usersRepository.save(adminUser);

    // Setup barbershop
    const barbershop = Barbershop.create(
      {
        name: "Navalha de Ouro",
        ownerId: new UniqueEntityId(ownerId),
        location: "Rua Central, 100",
      },
      new UniqueEntityId(barbershopId),
    );
    await barbershopsRepository.save(barbershop);

    // Setup staff membership
    const staffMembership = Membership.create({
      barbershopId: new UniqueEntityId(barbershopId),
      userId: new UniqueEntityId(staffId),
      role: Role.BARBERMAN,
      state: "ACTIVE",
    });
    await membershipsRepository.create(staffMembership);

    // Setup booking completed
    const booking = Booking.create(
      {
        barbershopId: new UniqueEntityId(barbershopId),
        barbermanId: new UniqueEntityId(staffId),
        customerId: new UniqueEntityId(clientId),
        status: "COMPLETED",
        timezone: "America/Sao_Paulo",
      },
      new UniqueEntityId(bookingId),
    );
    await bookingsRepository.create(booking);
  });

  describe("CreateReviewUseCase", () => {
    it("deve criar avaliação para agendamento concluído e atualizar métricas da barbearia", async () => {
      const result = await createReviewUseCase.execute({
        userId: clientId,
        bookingId,
        rating: 5,
        comment: "Atendimento impecável!",
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.review.rating).toBe(5);
        expect(result.value.review.comment).toBe("Atendimento impecável!");
        expect(result.value.review.status).toBe("PUBLISHED");
      }

      const shop = await barbershopsRepository.findById(barbershopId);
      expect(shop?.rating).toBe(5);
      expect(shop?.reviewCount).toBe(1);
    });

    it("não deve permitir avaliar agendamento que não seja COMPLETED", async () => {
      const pendingBookingId = "77777777-7777-7777-7777-777777777777";
      const pendingBooking = Booking.create(
        {
          barbershopId: new UniqueEntityId(barbershopId),
          barbermanId: new UniqueEntityId(staffId),
          customerId: new UniqueEntityId(clientId),
          status: "CONFIRMED",
        },
        new UniqueEntityId(pendingBookingId),
      );
      await bookingsRepository.create(pendingBooking);

      const result = await createReviewUseCase.execute({
        userId: clientId,
        bookingId: pendingBookingId,
        rating: 4,
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.message).toBe(
          "Apenas agendamentos concluídos podem ser avaliados.",
        );
      }
    });

    it("não deve permitir que outro cliente avalie o agendamento", async () => {
      const intruderId = "88888888-8888-8888-8888-888888888888";
      const result = await createReviewUseCase.execute({
        userId: intruderId,
        bookingId,
        rating: 5,
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.message).toBe(
          "Apenas o cliente do atendimento pode avaliar este agendamento.",
        );
      }
    });

    it("não deve permitir que proprietário ou membro da equipe avalie a própria unidade", async () => {
      // Create completed booking where customer is staff
      const staffBookingId = "99999999-9999-9999-9999-999999999999";
      const staffBooking = Booking.create(
        {
          barbershopId: new UniqueEntityId(barbershopId),
          barbermanId: new UniqueEntityId(staffId),
          customerId: new UniqueEntityId(staffId),
          status: "COMPLETED",
        },
        new UniqueEntityId(staffBookingId),
      );
      await bookingsRepository.create(staffBooking);

      const result = await createReviewUseCase.execute({
        userId: staffId,
        bookingId: staffBookingId,
        rating: 5,
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.message).toBe(
          "Proprietários e membros da equipe não podem avaliar a própria unidade.",
        );
      }
    });

    it("não deve permitir avaliar a mesma reserva mais de uma vez", async () => {
      await createReviewUseCase.execute({
        userId: clientId,
        bookingId,
        rating: 5,
      });

      const duplicateResult = await createReviewUseCase.execute({
        userId: clientId,
        bookingId,
        rating: 4,
      });

      expect(duplicateResult.isLeft()).toBe(true);
      if (duplicateResult.isLeft()) {
        expect(duplicateResult.value.message).toBe(
          "Já existe uma avaliação para este agendamento.",
        );
      }
    });

    it("deve rejeitar nota inválida ou comentário superior a 1000 caracteres", async () => {
      const invalidRating = await createReviewUseCase.execute({
        userId: clientId,
        bookingId,
        rating: 6,
      });
      expect(invalidRating.isLeft()).toBe(true);

      const longComment = "a".repeat(1001);
      const invalidComment = await createReviewUseCase.execute({
        userId: clientId,
        bookingId,
        rating: 5,
        comment: longComment,
      });
      expect(invalidComment.isLeft()).toBe(true);
    });
  });

  describe("UpdateReviewUseCase & DeleteReviewUseCase", () => {
    let createdReviewId: string;

    beforeEach(async () => {
      const res = await createReviewUseCase.execute({
        userId: clientId,
        bookingId,
        rating: 4,
        comment: "Muito bom",
      });
      if (res.isRight()) {
        createdReviewId = res.value.review.id.toString();
      }
    });

    it("deve permitir que o autor edite a avaliação e recalcule a nota", async () => {
      const updateRes = await updateReviewUseCase.execute({
        userId: clientId,
        reviewId: createdReviewId,
        rating: 5,
        comment: "Excelente, melhorou ainda mais!",
        expectedVersion: 1,
      });

      expect(updateRes.isRight()).toBe(true);
      if (updateRes.isRight()) {
        expect(updateRes.value.review.rating).toBe(5);
        expect(updateRes.value.review.comment).toBe(
          "Excelente, melhorou ainda mais!",
        );
      }

      const shop = await barbershopsRepository.findById(barbershopId);
      expect(shop?.rating).toBe(5);
    });

    it("não deve permitir que outro usuário edite a avaliação", async () => {
      const updateRes = await updateReviewUseCase.execute({
        userId: "outro-usuario",
        reviewId: createdReviewId,
        rating: 1,
        expectedVersion: 1,
      });

      expect(updateRes.isLeft()).toBe(true);
    });

    it("deve permitir remoção lógica pelo autor e recalcular métricas", async () => {
      const deleteRes = await deleteReviewUseCase.execute({
        userId: clientId,
        reviewId: createdReviewId,
        expectedVersion: 1,
      });

      expect(deleteRes.isRight()).toBe(true);

      const shop = await barbershopsRepository.findById(barbershopId);
      expect(shop?.rating).toBe(0);
      expect(shop?.reviewCount).toBe(0);

      // Tentar editar avaliação deletada deve falhar
      const editDeleted = await updateReviewUseCase.execute({
        userId: clientId,
        reviewId: createdReviewId,
        rating: 5,
        expectedVersion: 1,
      });
      expect(editDeleted.isLeft()).toBe(true);
    });
  });

  describe("ListBarbershopReviewsUseCase", () => {
    it("deve retornar 'Ainda sem avaliações' (rating 0, count 0) se não houver avaliações", async () => {
      const listRes = await listBarbershopReviewsUseCase.execute({
        barbershopId,
      });

      expect(listRes.isRight()).toBe(true);
      if (listRes.isRight()) {
        expect(listRes.value.reviews.length).toBe(0);
        expect(listRes.value.averageRating).toBe(0);
        expect(listRes.value.reviewCount).toBe(0);
      }
    });

    it("deve listar avaliações publicadas enriquecidas com autor", async () => {
      await createReviewUseCase.execute({
        userId: clientId,
        bookingId,
        rating: 5,
        comment: "Corte perfeito!",
      });

      const listRes = await listBarbershopReviewsUseCase.execute({
        barbershopId,
      });

      expect(listRes.isRight()).toBe(true);
      if (listRes.isRight()) {
        expect(listRes.value.reviews.length).toBe(1);
        expect(listRes.value.reviews[0].rating).toBe(5);
        expect(listRes.value.reviews[0].author.name).toBe("Cliente Teste");
      }
    });
  });

  describe("ModerateReviewUseCase & ReportReviewUseCase", () => {
    let reviewId: string;

    beforeEach(async () => {
      const res = await createReviewUseCase.execute({
        userId: clientId,
        bookingId,
        rating: 1,
        comment: "Comentário ofensivo com spam",
      });
      if (res.isRight()) {
        reviewId = res.value.review.id.toString();
      }
    });

    it("deve permitir denunciar uma avaliação", async () => {
      const repRes = await reportReviewUseCase.execute({
        reporterUserId: ownerId,
        reviewId,
        reason: "Linguagem abusiva e ofensiva.",
      });

      expect(repRes.isRight()).toBe(true);
      expect(reviewsRepository.reports.length).toBe(1);
    });

    it("deve permitir que PLATFORM_ADMIN oculte avaliação e recalcule métricas", async () => {
      const modRes = await moderateReviewUseCase.execute({
        adminUserId: adminId,
        reviewId,
        action: "HIDE",
        note: "Ocultado por violação dos termos de conduta.",
        expectedVersion: 1,
      });

      expect(modRes.isRight()).toBe(true);

      const review = await reviewsRepository.findById(reviewId);
      expect(review?.status).toBe("HIDDEN_BY_MODERATION");

      // Avaliação ocultada não pode ser editada pelo cliente
      const clientEditRes = await updateReviewUseCase.execute({
        userId: clientId,
        reviewId,
        rating: 5,
        expectedVersion: 1,
      });
      expect(clientEditRes.isLeft()).toBe(true);

      // Métricas da barbearia recalculadas sem a avaliação ocultada
      const shop = await barbershopsRepository.findById(barbershopId);
      expect(shop?.reviewCount).toBe(0);
      expect(shop?.rating).toBe(0);
    });

    it("não deve permitir que usuário comum modere avaliações", async () => {
      const modRes = await moderateReviewUseCase.execute({
        adminUserId: ownerId, // Proprietário não é PLATFORM_ADMIN
        reviewId,
        action: "HIDE",
        expectedVersion: 1,
      });

      expect(modRes.isLeft()).toBe(true);
      if (modRes.isLeft()) {
        expect(modRes.value.message).toBe(
          "Apenas administradores da plataforma podem moderar avaliações.",
        );
      }
    });
  });

  describe("Multi-target Reviews, Snapshots & Platform Feedback Isolation", () => {
    const multiBookingId = "aaaaaaaa-1111-1111-1111-111111111111";
    const serviceCorteId = "bbbbbbbb-1111-1111-1111-111111111111";
    const serviceBarbaId = "cccccccc-1111-1111-1111-111111111111";
    const snapshotBookingId = "dddddddd-1111-1111-1111-111111111111";
    const snapshotItemId = "eeeeeeee-1111-1111-1111-111111111111";

    beforeEach(async () => {
      await usersRepository.save(
        User.create(
          {
            name: "Barbeiro Profissional",
            email: "barber@example.com",
            cpf: "44455566677",
            accountType: "CLIENT",
            password: Password.create("hashed_pw"),
          },
          new UniqueEntityId(staffId),
        ),
      );

      const multiBooking = Booking.create(
        {
          barbershopId: new UniqueEntityId(barbershopId),
          barbermanId: new UniqueEntityId(staffId),
          customerId: new UniqueEntityId(clientId),
          status: "COMPLETED",
          timezone: "America/Sao_Paulo",
        },
        new UniqueEntityId(multiBookingId),
      );
      await bookingsRepository.createWithItems({
        booking: multiBooking,
        items: [
          BookingServiceItem.create({
            bookingId: new UniqueEntityId(multiBookingId),
            serviceId: new UniqueEntityId(serviceCorteId),
            title: "Corte Navalhado",
            priceInCents: 6000,
            durationInMinutes: 40,
            legacyAggregate: false,
          }),
          BookingServiceItem.create({
            bookingId: new UniqueEntityId(multiBookingId),
            serviceId: new UniqueEntityId(serviceBarbaId),
            title: "Barba Terapia",
            priceInCents: 4500,
            durationInMinutes: 30,
            legacyAggregate: false,
          }),
        ],
      });

      const snapshotBooking = Booking.create(
        {
          barbershopId: new UniqueEntityId(barbershopId),
          barbermanId: new UniqueEntityId(staffId),
          customerId: new UniqueEntityId(clientId),
          status: "COMPLETED",
          timezone: "America/Sao_Paulo",
        },
        new UniqueEntityId(snapshotBookingId),
      );
      await bookingsRepository.createWithItems({
        booking: snapshotBooking,
        items: [
          BookingServiceItem.create(
            {
              bookingId: new UniqueEntityId(snapshotBookingId),
              serviceId: null,
              title: "Sobrancelha (Snapshot Legado)",
              priceInCents: 2500,
              durationInMinutes: 15,
              legacyAggregate: true,
            },
            new UniqueEntityId(snapshotItemId),
          ),
        ],
      });
    });

    it("deve criar avaliação multi-alvo (barbearia, barbeiro e vários serviços) mantendo agregados independentes e feedback privado isolado", async () => {
      const result = await createReviewUseCase.execute({
        userId: clientId,
        bookingId: multiBookingId,
        rating: 5,
        barberId: staffId,
        barberRating: 4,
        serviceRatings: [
          { serviceId: serviceCorteId, rating: 3 },
          { serviceId: serviceBarbaId, rating: 2 },
        ],
        comment: "Excelente ambiente, barba poderia melhorar.",
        platformFeedback: {
          rating: 1,
          comment: "Feedback privado apenas sobre o app Smart Barber.",
        },
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.review.rating).toBe(5);
        expect(result.value.review.items).toHaveLength(4);
        expect(result.value.platformFeedback?.rating).toBe(1);
        expect(result.value.platformFeedback?.comment).toContain(
          "Smart Barber",
        );
      }

      const shop = await barbershopsRepository.findById(barbershopId);
      expect(shop?.rating).toBe(5);
      expect(shop?.reviewCount).toBe(1);

      const barberReviews = await listTargetReviewsUseCase.execute({
        barbershopId,
        targetType: "BARBER",
        targetId: staffId,
      });
      expect(barberReviews.isRight()).toBe(true);
      if (barberReviews.isRight()) {
        expect(barberReviews.value.averageRating).toBe(4);
        expect(barberReviews.value.reviewCount).toBe(1);
        expect(barberReviews.value.reviews[0].rating).toBe(4);
      }

      const corteReviews = await listTargetReviewsUseCase.execute({
        barbershopId,
        targetType: "SERVICE",
        targetId: serviceCorteId,
      });
      expect(corteReviews.isRight()).toBe(true);
      if (corteReviews.isRight()) {
        expect(corteReviews.value.averageRating).toBe(3);
        expect(corteReviews.value.reviewCount).toBe(1);
      }

      const barbaReviews = await listTargetReviewsUseCase.execute({
        barbershopId,
        targetType: "SERVICE",
        targetId: serviceBarbaId,
      });
      expect(barbaReviews.isRight()).toBe(true);
      if (barbaReviews.isRight()) {
        expect(barbaReviews.value.averageRating).toBe(2);
        expect(barbaReviews.value.reviewCount).toBe(1);
      }

      const publicShopReviews = await listBarbershopReviewsUseCase.execute({
        barbershopId,
      });
      expect(publicShopReviews.isRight()).toBe(true);
      if (publicShopReviews.isRight()) {
        expect(publicShopReviews.value.averageRating).toBe(5);
        expect(publicShopReviews.value.reviews[0].comment).not.toContain(
          "Smart Barber",
        );
      }

      const fetched = await getBookingReviewUseCase.execute({
        userId: clientId,
        bookingId: multiBookingId,
      });
      expect(fetched.isRight()).toBe(true);
      if (fetched.isRight()) {
        expect(fetched.value.review?.items).toHaveLength(4);
        expect(fetched.value.platformFeedback?.rating).toBe(1);
      }
    });

    it("deve rejeitar barbeiro ou serviço que não pertence ao agendamento", async () => {
      const wrongBarberRes = await createReviewUseCase.execute({
        userId: clientId,
        bookingId: multiBookingId,
        rating: 5,
        barberId: "99999999-9999-9999-9999-999999999999",
        barberRating: 5,
      });
      expect(wrongBarberRes.isLeft()).toBe(true);

      const wrongServiceRes = await createReviewUseCase.execute({
        userId: clientId,
        bookingId: multiBookingId,
        rating: 5,
        serviceRatings: [
          {
            serviceId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
            rating: 5,
          },
        ],
      });
      expect(wrongServiceRes.isLeft()).toBe(true);
    });

    it("deve preservar snapshots sem serviceId via bookingServiceItemId e impedir duplicidade por item", async () => {
      const dupRes = await createReviewUseCase.execute({
        userId: clientId,
        bookingId: snapshotBookingId,
        rating: 5,
        serviceRatings: [
          { bookingServiceItemId: snapshotItemId, rating: 4 },
          { bookingServiceItemId: snapshotItemId, rating: 5 },
        ],
      });
      expect(dupRes.isLeft()).toBe(true);

      const okRes = await createReviewUseCase.execute({
        userId: clientId,
        bookingId: snapshotBookingId,
        rating: 5,
        serviceRatings: [{ bookingServiceItemId: snapshotItemId, rating: 4 }],
      });
      expect(okRes.isRight()).toBe(true);
      if (okRes.isRight()) {
        const serviceItem = okRes.value.review.items.find(
          (i) => i.targetType === "SERVICE",
        );
        expect(serviceItem?.targetId).toBeNull();
        expect(serviceItem?.bookingServiceItemId?.toString()).toBe(
          snapshotItemId,
        );
        expect(serviceItem?.targetLabel).toBe("Sobrancelha (Snapshot Legado)");
        expect(serviceItem?.rating).toBe(4);
      }
    });

    it("deve atualizar itens da avaliação mantendo controle de versão e separação de alvos", async () => {
      const created = await createReviewUseCase.execute({
        userId: clientId,
        bookingId: multiBookingId,
        rating: 4,
        barberRating: 5,
        serviceRatings: [{ serviceId: serviceCorteId, rating: 3 }],
      });
      expect(created.isRight()).toBe(true);
      if (!created.isRight()) return;

      const updated = await updateReviewUseCase.execute({
        userId: clientId,
        bookingId: multiBookingId,
        rating: 2,
        barberRating: 3,
        serviceRatings: [{ serviceId: serviceBarbaId, rating: 5 }],
        expectedVersion: 1,
      });
      expect(updated.isRight()).toBe(true);
      if (!updated.isRight()) return;

      expect(updated.value.review.version).toBe(2);
      expect(updated.value.review.rating).toBe(2);

      const corteAfter = await listTargetReviewsUseCase.execute({
        barbershopId,
        targetType: "SERVICE",
        targetId: serviceCorteId,
      });
      expect(corteAfter.isRight()).toBe(true);
      if (corteAfter.isRight()) {
        expect(corteAfter.value.reviewCount).toBe(0);
        expect(corteAfter.value.averageRating).toBeNull();
      }

      const barbaAfter = await listTargetReviewsUseCase.execute({
        barbershopId,
        targetType: "SERVICE",
        targetId: serviceBarbaId,
      });
      expect(barbaAfter.isRight()).toBe(true);
      if (barbaAfter.isRight()) {
        expect(barbaAfter.value.reviewCount).toBe(1);
        expect(barbaAfter.value.averageRating).toBe(5);
      }
    });
  });
});
