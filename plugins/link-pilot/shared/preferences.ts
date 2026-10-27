import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const destinationSchema = z.enum(["in-app", "external"]);
export const valuesSchema = z
  .object({
    click: destinationSchema.default("in-app"),
    modifiedClick: destinationSchema.default("external"),
  })
  .strict();
export type LinkPreferences = z.infer<typeof valuesSchema>;
export type Destination = z.infer<typeof destinationSchema>;
export const preferences = defineSettings({
  id: "link-behavior",
  scope: "host",
  version: 1,
  schema: valuesSchema,
});
