/**
 * Host-half declarations for `dsh-deepseek-balance-float`.
 *
 * The Host half registers no service, route or Remote: it exists only so the
 * package is a mountable DSH Loader entry, which is what makes the browser
 * bundle in `lib/client.js` publishable.
 */

/** No Host service is required; the account Remote belongs to another plugin. */
export declare const inject: readonly string[]

/** @param ctx - Host root context; unused by design. */
export declare function apply(ctx: unknown): void
