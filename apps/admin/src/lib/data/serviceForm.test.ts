import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { NBSP } from "@/lib/format";

import {
  checkDraft,
  createBody,
  DURATION_INVALID,
  draftFrom,
  editLabel,
  isEmptyBody,
  NAME_EMPTY,
  NAME_TOO_LONG,
  PRICE_INVALID,
  savedText,
  serviceSaveErrorKind,
  serviceSaveErrorText,
  updateBody,
  upsertService,
} from "./serviceForm";
import { formatAmount, type Service } from "./services";

const service: Service = {
  id: "s1",
  name: "Массаж спины",
  durationMin: 60,
  price: 8000,
  sortOrder: 0,
  active: true,
};

function draft(name: string, duration: string, price: string) {
  return { name, duration, price };
}

describe("draftFrom", () => {
  it("is empty for a new service", () => {
    expect(draftFrom(null)).toEqual({ name: "", duration: "", price: "" });
  });

  it("fills the fields of a service", () => {
    expect(draftFrom(service)).toEqual({
      name: "Массаж спины",
      duration: "60",
      price: formatAmount(8000),
    });
  });
});

describe("checkDraft name", () => {
  it.each(["", "   "])("rejects %j", (name) => {
    expect(checkDraft(draft(name, "60", "100")).problems.name).toBe(NAME_EMPTY);
  });

  it("rejects 101 characters", () => {
    expect(checkDraft(draft("а".repeat(101), "60", "100")).problems.name).toBe(NAME_TOO_LONG);
  });

  it("trims 100 characters with spaces around", () => {
    const result = checkDraft(draft(`  ${"а".repeat(100)}  `, "60", "100"));
    expect(result.problems).toEqual({});
    expect(result.values?.name).toBe("а".repeat(100));
  });
});

describe("checkDraft duration", () => {
  it.each(["", "4", "481", "6.5", "abc", "1000"])("rejects %j", (duration) => {
    expect(checkDraft(draft("А", duration, "100")).problems.duration).toBe(DURATION_INVALID);
  });

  it.each([
    ["5", 5],
    ["480", 480],
  ])("accepts %s", (duration, minutes) => {
    expect(checkDraft(draft("А", duration, "100")).values?.durationMin).toBe(minutes);
  });
});

describe("checkDraft price", () => {
  it.each(["", "-1", "abc", "1,555", "12345678901"])("rejects %j", (price) => {
    expect(checkDraft(draft("А", "60", price)).problems.price).toBe(PRICE_INVALID);
  });

  it.each([
    ["0", 0],
    ["8000", 8000],
    ["8 000", 8000],
    [`8${NBSP}000`, 8000],
    ["8 000", 8000],
    ["1 500,5", 1500.5],
    ["1500.50", 1500.5],
  ])("reads %j", (price, value) => {
    expect(checkDraft(draft("А", "60", price)).values?.price).toBe(value);
  });

  it("reads back what the form shows, with kopecks", () => {
    const priced = { ...service, price: 1500.5 };
    expect(checkDraft(draftFrom(priced)).values).toEqual({
      name: priced.name,
      durationMin: 60,
      price: 1500.5,
    });
  });

  it("reports all three problems at once", () => {
    const { values, problems } = checkDraft(draft("", "", ""));
    expect(values).toBeNull();
    expect(Object.keys(problems)).toEqual(["name", "duration", "price"]);
  });
});

describe("request bodies", () => {
  const values = { name: "Массаж рук", durationMin: 40, price: 7500 };

  it("creates without sortOrder", () => {
    expect(createBody(values)).toEqual(values);
  });

  it("sends nothing when nothing changed", () => {
    const body = updateBody(service, { name: service.name, durationMin: 60, price: 8000 });
    expect(body).toEqual({});
    expect(isEmptyBody(body)).toBe(true);
  });

  it("sends only the changed price", () => {
    const body = updateBody(service, { name: service.name, durationMin: 60, price: 9000 });
    expect(body).toEqual({ price: 9000 });
    expect(isEmptyBody(body)).toBe(false);
  });

  it("sends active only when it differs", () => {
    const same = { name: service.name, durationMin: 60, price: 8000 };
    expect(updateBody(service, same, false)).toEqual({ active: false });
    expect(updateBody(service, same, true)).toEqual({});
  });
});

describe("upsertService", () => {
  const other = { ...service, id: "s2", name: "Массаж ног" };

  it("replaces in place", () => {
    const saved = { ...service, price: 9000 };
    expect(upsertService([service, other], saved)).toEqual([saved, other]);
  });

  it("appends a new one", () => {
    const created = { ...service, id: "s3" };
    expect(upsertService([service, other], created)).toEqual([service, other, created]);
  });

  it("keeps an unloaded list unloaded", () => {
    expect(upsertService(undefined, service)).toBeUndefined();
  });
});

describe("save errors", () => {
  it("maps errors to kinds", () => {
    expect(serviceSaveErrorKind(new ApiError("network"))).toBe("offline");
    expect(serviceSaveErrorKind(new ApiError("problem", { status: 400, code: "INVALID_REQUEST" }))).toBe(
      "invalid",
    );
    expect(
      serviceSaveErrorKind(new ApiError("problem", { status: 404, code: "SERVICE_NOT_FOUND" })),
    ).toBe("notFound");
    expect(serviceSaveErrorKind(new ApiError("server", { status: 500 }))).toBe("failed");
    expect(serviceSaveErrorKind(new Error("x"))).toBe("failed");
  });

  it("says the code of a failed save", () => {
    expect(serviceSaveErrorText("failed", new ApiError("server", { status: 500 }))).toBe(
      "Сервер ответил с ошибкой. Код: 500. Услуга не сохранена.",
    );
    expect(serviceSaveErrorText("failed", new Error("x"))).toBe(
      "Услуга не сохранена. Попробуйте ещё раз через минуту.",
    );
  });

  it("has fixed texts for known kinds", () => {
    expect(serviceSaveErrorText("invalid", null)).toBe(
      "Сервер не принял услугу. Проверьте название, длительность и цену.",
    );
  });
});

describe("texts", () => {
  it("builds the result line", () => {
    expect(savedText("saved", "А")).toBe("Сохранено: «А».");
    expect(savedText("hidden", "А")).toBe("Услуга «А» скрыта — бот её не предлагает.");
    expect(savedText("shown", "А")).toBe("Услуга «А» снова доступна для записи.");
  });

  it("builds the edit label", () => {
    expect(editLabel("Массаж спины")).toBe("Изменить: Массаж спины");
  });
});
