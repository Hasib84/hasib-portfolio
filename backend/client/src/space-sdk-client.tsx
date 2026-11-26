import { QueryClient } from "@tanstack/react-query";

export const spaceQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
    },
  },
});

export function SafeAreaTopScrim({ backgroundColor }: { backgroundColor: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)]"
      style={{ backgroundColor }}
    />
  );
}

export interface ActionDefLike<TReq = unknown, TRes = unknown> {
  _req?: TReq;
  _res?: TRes;
}

export type ApiRequest<
  TClient,
  K extends keyof TClient,
> = TClient[K] extends (args: infer A) => Promise<unknown> ? A : never;

export type ApiResponse<
  TClient,
  K extends keyof TClient,
> = TClient[K] extends (args: never) => Promise<infer R> ? R : never;

type ClientMethods<TModule> = {
  [K in keyof TModule]: TModule[K] extends {
    _req: infer TReq;
    _res: infer TRes;
  }
    ? (args: TReq) => Promise<TRes>
    : never;
};

export function createActionClient<TModule extends Record<string, unknown>>(): ClientMethods<TModule> {
  return new Proxy({} as ClientMethods<TModule>, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return async (args: unknown) => {
        const res = await fetch("/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: prop, args: args ?? {} }),
        });
        const text = await res.text();
        let data: unknown = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = null;
          }
        }
        if (!res.ok) {
          const msg =
            data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : `Request failed (${res.status})`;
          throw new Error(msg);
        }
        return data;
      };
    },
  });
}
