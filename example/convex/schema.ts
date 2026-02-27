import { defineSchema } from "convex/server";
import { stripeTables } from "@raideno/convex-stripe/server";

export default defineSchema({
  ...stripeTables,
});
