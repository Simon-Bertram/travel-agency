/// <reference types="astro/client" />

import type { RequestLogger } from "evlog";

declare namespace App {
  interface Locals {
    log: RequestLogger;
  }
}
