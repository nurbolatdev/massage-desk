import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Linking } from "react-native";
import { callPhone, openWhatsApp } from "@/lib/contact";

describe("contact", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the dialer for a phone number", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await callPhone("+998901234567");
    expect(open).toHaveBeenCalledWith("tel:+998901234567");
  });

  it("opens WhatsApp with the number without a plus sign", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await openWhatsApp("+998901234567");
    expect(open).toHaveBeenCalledWith("https://wa.me/998901234567");
  });
});
