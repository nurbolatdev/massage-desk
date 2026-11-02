import { describe, expect, expectTypeOf, it } from "vitest";
import type { paths } from "./index.js";

type VerifyGet = paths["/webhook/whatsapp"]["get"];
type VerifyQuery = NonNullable<VerifyGet["parameters"]["query"]>;

describe("generated api types", () => {
  it("types the webhook verification query parameters", () => {
    expectTypeOf<VerifyQuery["hub.challenge"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<VerifyQuery["hub.mode"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<VerifyQuery["hub.verify_token"]>().toEqualTypeOf<string | undefined>();
  });

  it("types the webhook 200 text/plain body as string", () => {
    type Ok = VerifyGet["responses"][200]["content"]["text/plain"];
    expectTypeOf<Ok>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });
});

describe("generated /slots types", () => {
  type SlotsGet = paths["/slots"]["get"];
  type SlotsQuery = SlotsGet["parameters"]["query"];
  type SlotsOk = SlotsGet["responses"][200]["content"]["application/json"];

  it("types the required query parameters", () => {
    expectTypeOf<SlotsQuery["serviceId"]>().toEqualTypeOf<string>();
    expectTypeOf<SlotsQuery["day"]>().toEqualTypeOf<string>();
  });

  it("types the 200 body with required fields", () => {
    expectTypeOf<SlotsOk["starts"]>().toEqualTypeOf<string[]>();
    expectTypeOf<SlotsOk["durationMin"]>().toEqualTypeOf<number>();
    expectTypeOf<SlotsOk["timeZone"]>().toEqualTypeOf<string>();
    expectTypeOf<SlotsOk["day"]>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });
});

describe("generated /appointments types", () => {
  type CreatePost = paths["/appointments"]["post"];
  type CreateBody = CreatePost["requestBody"]["content"]["application/json"];
  type Created = CreatePost["responses"][201]["content"]["application/json"];

  it("types the create request body", () => {
    expectTypeOf<CreateBody["clientId"]>().toEqualTypeOf<string>();
    expectTypeOf<CreateBody["serviceId"]>().toEqualTypeOf<string>();
    expectTypeOf<CreateBody["start"]>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });

  it("types the 201 body with status and source unions", () => {
    expectTypeOf<Created["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Created["start"]>().toEqualTypeOf<string>();
    expectTypeOf<Created["end"]>().toEqualTypeOf<string>();
    expectTypeOf<Created["status"]>().toEqualTypeOf<"confirmed" | "cancelled" | "no_show" | "done">();
    expectTypeOf<Created["source"]>().toEqualTypeOf<"bot" | "manual">();
    expect(true).toBe(true);
  });
});

describe("generated appointment command types", () => {
  type Status = "confirmed" | "cancelled" | "no_show" | "done";
  type Reschedule = paths["/appointments/{id}/reschedule"]["post"];
  type Cancel = paths["/appointments/{id}/cancel"]["post"];
  type NoShow = paths["/appointments/{id}/no-show"]["post"];

  it("types the reschedule body and path parameter", () => {
    expectTypeOf<Reschedule["requestBody"]["content"]["application/json"]["start"]>().toEqualTypeOf<string>();
    expectTypeOf<Reschedule["parameters"]["path"]["id"]>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });

  it("has no request body for cancel and no-show", () => {
    expectTypeOf<Cancel["requestBody"]>().toEqualTypeOf<undefined>();
    expectTypeOf<NoShow["requestBody"]>().toEqualTypeOf<undefined>();
    expectTypeOf<Cancel["parameters"]["path"]["id"]>().toEqualTypeOf<string>();
    expectTypeOf<NoShow["parameters"]["path"]["id"]>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });

  it("types the 200 status union for all three", () => {
    expectTypeOf<Reschedule["responses"][200]["content"]["application/json"]["status"]>().toEqualTypeOf<Status>();
    expectTypeOf<Cancel["responses"][200]["content"]["application/json"]["status"]>().toEqualTypeOf<Status>();
    expectTypeOf<NoShow["responses"][200]["content"]["application/json"]["status"]>().toEqualTypeOf<Status>();
    expect(true).toBe(true);
  });
});
