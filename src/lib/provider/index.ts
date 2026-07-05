import { isMockMode } from "@/lib/config";
import { fiveSimProvider } from "./fivesim";
import { mockProvider } from "./mock";
import type { SmsProvider } from "./types";

// API kaliti bo'lsa — haqiqiy 5sim, bo'lmasa — demo (mock).
export const provider: SmsProvider = isMockMode ? mockProvider : fiveSimProvider;

export * from "./types";
