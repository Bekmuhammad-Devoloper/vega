import { config } from "@/lib/config";
import { heroSmsProvider } from "./herosms";
import { fiveSimProvider } from "./fivesim";
import { mockProvider } from "./mock";
import type { SmsProvider } from "./types";

// Ustuvorlik: HeroSMS (arzon) -> 5sim -> demo (mock).
export const provider: SmsProvider = config.herosmsApiKey
  ? heroSmsProvider
  : config.fivesimApiKey
    ? fiveSimProvider
    : mockProvider;

export * from "./types";
