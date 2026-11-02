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

describe("generated /clients types", () => {
  type ListGet = paths["/clients"]["get"];
  type ListQuery = NonNullable<ListGet["parameters"]["query"]>;
  type ListOk = ListGet["responses"][200]["content"]["application/json"];
  type CreatePost = paths["/clients"]["post"];
  type CreateBody = CreatePost["requestBody"]["content"]["application/json"];
  type PatchBody = paths["/clients/{id}"]["patch"]["requestBody"]["content"]["application/json"];

  it("types the list query", () => {
    expectTypeOf<ListQuery["q"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ListQuery["limit"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ListQuery["offset"]>().toEqualTypeOf<number | undefined>();
    expect(true).toBe(true);
  });

  it("types a client with nullable name and notes", () => {
    type Item = ListOk[number];
    expectTypeOf<Item["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Item["phone"]>().toEqualTypeOf<string>();
    expectTypeOf<Item["createdAt"]>().toEqualTypeOf<string>();
    expectTypeOf<Item["name"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Item["notes"]>().toEqualTypeOf<string | null>();
    expect(true).toBe(true);
  });

  it("types the create body", () => {
    expectTypeOf<CreateBody["phone"]>().toEqualTypeOf<string>();
    expectTypeOf<CreateBody["name"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<CreateBody["notes"]>().toEqualTypeOf<string | undefined>();
    expect(true).toBe(true);
  });

  it("does not allow changing the phone", () => {
    expectTypeOf<keyof PatchBody>().toEqualTypeOf<"name" | "notes">();
    expect(true).toBe(true);
  });
});

describe("generated /services types", () => {
  type ListOk = paths["/services"]["get"]["responses"][200]["content"]["application/json"];
  type CreateBody = paths["/services"]["post"]["requestBody"]["content"]["application/json"];
  type PatchBody = paths["/services/{id}"]["patch"]["requestBody"]["content"]["application/json"];

  it("types a service", () => {
    type Item = ListOk[number];
    expectTypeOf<Item["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Item["name"]>().toEqualTypeOf<string>();
    expectTypeOf<Item["price"]>().toEqualTypeOf<number>();
    expectTypeOf<Item["durationMin"]>().toEqualTypeOf<number>();
    expectTypeOf<Item["sortOrder"]>().toEqualTypeOf<number>();
    expectTypeOf<Item["active"]>().toEqualTypeOf<boolean>();
    expect(true).toBe(true);
  });

  it("types the create body", () => {
    expectTypeOf<CreateBody["name"]>().toEqualTypeOf<string>();
    expectTypeOf<CreateBody["durationMin"]>().toEqualTypeOf<number>();
    expectTypeOf<CreateBody["price"]>().toEqualTypeOf<number>();
    expectTypeOf<CreateBody["sortOrder"]>().toEqualTypeOf<number | undefined>();
    expect(true).toBe(true);
  });

  it("types the patch body with optional fields", () => {
    expectTypeOf<PatchBody["active"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<PatchBody["price"]>().toEqualTypeOf<number | undefined>();
    expect(true).toBe(true);
  });
});

describe("generated /working-hours types", () => {
  type GetOk = paths["/working-hours"]["get"]["responses"][200]["content"]["application/json"];
  type PutBody = paths["/working-hours"]["put"]["requestBody"]["content"]["application/json"];
  type Block = { weekday: number; start: string; end: string };

  it("types the blocks of the response", () => {
    expectTypeOf<GetOk["blocks"][number]>().toEqualTypeOf<Block>();
    expect(true).toBe(true);
  });

  it("types the blocks of the request", () => {
    expectTypeOf<PutBody["blocks"][number]>().toEqualTypeOf<Block>();
    expect(true).toBe(true);
  });
});


describe("generated /time-off types", () => {
  type ListGet = paths["/time-off"]["get"];
  type Created = paths["/time-off"]["post"]["responses"][201]["content"]["application/json"];
  type CreateBody = paths["/time-off"]["post"]["requestBody"]["content"]["application/json"];
  type DeletePath = paths["/time-off/{id}"]["delete"]["parameters"]["path"];

  it("types the required list window", () => {
    expectTypeOf<ListGet["parameters"]["query"]["from"]>().toEqualTypeOf<string>();
    expectTypeOf<ListGet["parameters"]["query"]["to"]>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });

  it("types a time off period", () => {
    expectTypeOf<Created["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Created["start"]>().toEqualTypeOf<string>();
    expectTypeOf<Created["end"]>().toEqualTypeOf<string>();
    expectTypeOf<Created["reason"]>().toEqualTypeOf<string | null>();
    expect(true).toBe(true);
  });

  it("types the create body and the delete path", () => {
    expectTypeOf<CreateBody["start"]>().toEqualTypeOf<string>();
    expectTypeOf<CreateBody["end"]>().toEqualTypeOf<string>();
    expectTypeOf<CreateBody["reason"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DeletePath["id"]>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });
});
