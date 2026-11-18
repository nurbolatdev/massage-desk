import { toWhatsAppId } from "@massage-desk/shared";
import { Linking } from "react-native";

export function callPhone(phone: string): Promise<void> {
  return Linking.openURL(`tel:${phone}`);
}

export function openWhatsApp(phone: string): Promise<void> {
  return Linking.openURL(`https://wa.me/${toWhatsAppId(phone)}`);
}
