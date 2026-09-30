/**
 * Host half of `dsh-deepseek-balance-float`.
 *
 * The widget itself is browser-only: it reads the signed-in account through the
 * existing generated `ctx.remote.account` namespace, which the account controller
 * already exposes to every Web client of this Host. This half therefore owns no
 * Node state, registers no route and adds no Remote of its own — it exists so the
 * package is a mountable Loader entry, which is also what makes
 * `dsh-client-modules` publish its `./client` bundle.
 *
 * It is deliberately inert: the web boot audit fails the application when an
 * entry does not activate, so this half must not depend on a service, a logger,
 * or any other optional member at mount time.
 */

/** No Host service is required; the account Remote belongs to another plugin. */
export const inject = []

/** @param {unknown} _ctx - Host root context; unused by design. */
export function apply(_ctx) {}
