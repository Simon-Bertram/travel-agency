/// <reference types="astro/client" />

import type { RequestLogger } from "evlog";

declare global {
  namespace App {
    interface Locals {
      cfContext?: {
        waitUntil: (promise: Promise<unknown>) => void;
        passThroughOnException: () => void;
      };
      log: RequestLogger;
    }
  }
}
