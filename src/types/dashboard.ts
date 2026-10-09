import { z } from "zod";
const nullableNumber = z.number().finite().nullable();
const registrationSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/), count: z.number().int().nonnegative(),
  market: nullableNumber, share: nullableNumber, mom: nullableNumber, yoy: nullableNumber,
});
const officialUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password &&
    ["thb.gov.tw", "motc.gov.tw", "data.gov.tw", "tdx.transportdata.tw"].some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host));
});
const base = z.object({
  status: z.enum(["ok", "stale", "unavailable"]), source: z.string(), sourceUrl: officialUrl,
  fetchedAt: z.string().datetime({ offset: true }).nullable(),
  attemptedAt: z.string().datetime({ offset: true }).nullable(),
  sha256: z.string().nullable(), downloadUrl: officialUrl.nullable(), error: z.string().nullable(),
});
export const dashboardSchema = z.object({
  schemaVersion: z.literal(1), generatedAt: z.string().datetime({ offset: true }).nullable(), scope: z.string(),
  registrations: base.extend({ rows: z.array(registrationSchema) }),
  market: base.extend({ rows: z.array(z.object({period: z.string(), count: z.number().int().nonnegative()})) }),
  charging: base.extend({scope: z.string(), rows: z.array(z.object({
    id: z.string(), name: z.string(), city: z.string(), town: z.string(), address: z.string(),
    updatedAt: z.string().nullable(),
  }))}),
  news: base.extend({ rows: z.array(z.object({
    title: z.string(), url: officialUrl, publishedAt: z.string().nullable(), publisher: z.string(),
    category: z.enum(["Tesla", "政策"]),
  }))}),
});
export type DashboardData = z.infer<typeof dashboardSchema>;
export type Registration = DashboardData["registrations"]["rows"][number];
