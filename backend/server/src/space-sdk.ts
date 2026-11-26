import { z } from "zod";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

export { z };

export interface Ctx {
  db<TSchema extends Record<string, unknown> = Record<string, unknown>>(): BaseSQLiteDatabase<
    "sync" | "async",
    unknown,
    TSchema
  >;
  invalidateQueries(): void;
  saveUpload?(fileName: string, bytes: Uint8Array): string;
}

export interface ActionDefinition<TReq extends z.ZodTypeAny, TRes extends z.ZodTypeAny> {
  description: string;
  request: TReq;
  response: TRes;
  handler: (ctx: Ctx, args: z.infer<TReq>) => Promise<z.infer<TRes>>;
  readonly _req?: z.infer<TReq>;
  readonly _res?: z.infer<TRes>;
}

export type ActionsModule = Record<string, ActionDefinition<z.ZodTypeAny, z.ZodTypeAny>>;

export function defineAction<TReq extends z.ZodTypeAny, TRes extends z.ZodTypeAny>(
  def: ActionDefinition<TReq, TRes>,
): ActionDefinition<TReq, TRes> & {
  readonly _req: z.infer<TReq>;
  readonly _res: z.infer<TRes>;
} {
  return def as ActionDefinition<TReq, TRes> & {
    readonly _req: z.infer<TReq>;
    readonly _res: z.infer<TRes>;
  };
}
