import { isCancel } from "@clack/prompts";

/**
 * Narrowing wrapper around `@clack/prompts`' `isCancel`.
 *
 * As of @clack/prompts 1.8.0 the upstream guard is declared as
 * `isCancel(value: unknown): value is typeof CANCEL_SYMBOL`, where `CANCEL_SYMBOL` is a *unique*
 * symbol. Excluding a unique symbol from `string | symbol` leaves `string | symbol` untouched, so
 * `if (isCancel(x)) { return; }` no longer narrows `x` to `string` afterwards.
 *
 * The `Prompts` abstraction deliberately returns `T | symbol` rather than leaking a @clack type, so
 * this guard restores the narrowing the commands rely on.
 */
export function isCancelled<T>(value: T | symbol): value is symbol {
  return isCancel(value);
}
