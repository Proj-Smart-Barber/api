import { describe, it, expect } from "vitest";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Review } from "./review";

describe("Review Entity", () => {
  it("cria uma avaliação com nota inteira de 1 a 5 e status PUBLISHED", () => {
    const bookingId = new UniqueEntityId();
    const barbershopId = new UniqueEntityId();
    const customerId = new UniqueEntityId();

    const review = Review.create({
      bookingId,
      barbershopId,
      customerId,
      rating: 5,
      comment: "Excelente atendimento e corte impecável!",
    });

    expect(review.rating).toBe(5);
    expect(review.comment).toBe("Excelente atendimento e corte impecável!");
    expect(review.status).toBe("PUBLISHED");
    expect(review.version).toBe(1);
    expect(review.isPublished()).toBe(true);
  });

  it("rejeita nota menor que 1 ou maior que 5", () => {
    const bookingId = new UniqueEntityId();
    const barbershopId = new UniqueEntityId();
    const customerId = new UniqueEntityId();

    expect(() =>
      Review.create({
        bookingId,
        barbershopId,
        customerId,
        rating: 0,
      })
    ).toThrow("A nota deve ser um número inteiro de 1 a 5.");

    expect(() =>
      Review.create({
        bookingId,
        barbershopId,
        customerId,
        rating: 6,
      })
    ).toThrow("A nota deve ser um número inteiro de 1 a 5.");
  });

  it("rejeita comentário com mais de 1000 caracteres", () => {
    const bookingId = new UniqueEntityId();
    const barbershopId = new UniqueEntityId();
    const customerId = new UniqueEntityId();
    const longComment = "a".repeat(1001);

    expect(() =>
      Review.create({
        bookingId,
        barbershopId,
        customerId,
        rating: 4,
        comment: longComment,
      })
    ).toThrow("O comentário não pode exceder 1.000 caracteres.");
  });

  it("permite ao autor atualizar a avaliação incrementando a versão e validando conflito", () => {
    const review = Review.create({
      bookingId: new UniqueEntityId(),
      barbershopId: new UniqueEntityId(),
      customerId: new UniqueEntityId(),
      rating: 4,
      comment: "Bom",
    });

    // Tentativa de update com expectedVersion desatualizada
    expect(() => review.update({ rating: 5, comment: "Melhor", expectedVersion: 2 })).toThrow(
      "Conflito de versão na edição da avaliação."
    );

    // Update com versão correta
    review.update({ rating: 5, comment: "Melhor agora!", expectedVersion: 1 });
    expect(review.rating).toBe(5);
    expect(review.comment).toBe("Melhor agora!");
    expect(review.version).toBe(2);
  });

  it("permite remoção lógica pelo autor e moderação pelo admin", () => {
    const review = Review.create({
      bookingId: new UniqueEntityId(),
      barbershopId: new UniqueEntityId(),
      customerId: new UniqueEntityId(),
      rating: 3,
    });

    review.hideByModeration();
    expect(review.status).toBe("HIDDEN_BY_MODERATION");
    expect(review.isPublished()).toBe(false);

    // Edição pelo autor não pode publicar novamente avaliação ocultada pela moderação
    expect(() => review.update({ rating: 4, expectedVersion: 2 })).toThrow(
      "Esta avaliação foi ocultada pela moderação e não pode ser editada diretamente."
    );

    review.restoreByModeration();
    expect(review.status).toBe("PUBLISHED");
    expect(review.isPublished()).toBe(true);

    review.deleteByAuthor();
    expect(review.status).toBe("DELETED_BY_AUTHOR");
    expect(review.isPublished()).toBe(false);
  });
});
