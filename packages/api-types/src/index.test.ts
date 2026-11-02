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
