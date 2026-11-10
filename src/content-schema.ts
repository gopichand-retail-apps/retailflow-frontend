import { z } from 'zod'

export const contentModelSchema = z
  .object({
    version: z.literal(1),
    appId: z.string().min(1),
    locale: z.string().min(2),
    messages: z.record(z.string(), z.string()),
    data: z.record(z.string(), z.unknown()),
  })
  .strict()

export type ContentModel = z.infer<typeof contentModelSchema>
export type MessageValues = Record<string, string | number>
export type Translate = (key: string, values?: MessageValues) => string
