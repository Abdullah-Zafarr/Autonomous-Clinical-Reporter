import { z } from "zod";
export const reportSectionsSchema = z.object({
  findings: z.array(z.string().max(12000)).max(200),
  impression: z.array(z.string().max(12000)).max(200),
  recommendations: z.array(z.string().max(12000)).max(200).optional(),
});
