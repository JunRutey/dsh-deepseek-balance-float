/**
 * Offline contract check for `dsh-deepseek-balance-float`.
 *
 * Loads `lib/client.js` under a stubbed `window.__ModuleLoader__` exactly the way
 * the browser boots a plugin bundle, then drives the module's `apply(ctx)` with a
 * fake Cordis context and a fake DOM-free React. The last scenario drops the DOM
 * entirely, because the DSH web boot audit refuses to start the GUI when an
 * enabled client entry throws — so "no DOM" must degrade to "no card", never to
 * "no app". The Host half is imported for real to prove it is valid ESM with the
 * `apply`/`inject` shape the Loader expects.
 *
 * Run with the bundled Node: `node test/contract.mjs`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'lib', 'client.js'), 'utf8')

// --- Stub React: render the tree once so component-level crashes surface. -----
function createElement(type, props, ...children) {
	return { type, props: props ?? {}, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false) }
}
const React = {
	createElement,
	useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
	useRef: (initial) => ({ current: typeof initial === 'function' ? initial() : initial }),
	useEffect: () => {},
	useCallback: (fn) => fn,
	Fragment: Symbol('Fragment'),
}

// --- Stub the browser module envelope. ---------------------------------------
let factory = null
globalThis.window = {
	__ModuleLoader__: { load: (registration) => { factory = registration.factory } },
	localStorage: { getItem: () => null, setItem: () => {} },
	addEventListener: () => {},
	removeEventListener: () => {},
	innerWidth: 1440,
	innerHeight: 900,
	location: { origin: 'http://127.0.0.1:19387' },
}
globalThis.console = console

// --- Stub the two DOM operations the stylesheet lifetime uses. ----------------
const sheets = []
globalThis.document = {
	getElementById: (id) => sheets.find((sheet) => sheet.id === id) ?? null,
	createElement: () => {
		const element = {
			id: '',
			textContent: '',
			remove: () => { const at = sheets.indexOf(element); if (at >= 0) sheets.splice(at, 1) },
		}
		return element
	},
	head: { appendChild: (element) => { sheets.push(element) } },
}

new Function('window', source)(globalThis.window)
assert.ok(factory !== null, 'client.js registered a factory with __ModuleLoader__')

const exports_ = factory((id) => {
	if (id === 'react') return React
	throw new Error(`unexpected external module request: ${id}`)
})

assert.equal(typeof exports_.apply, 'function', 'exports.apply')
assert.deepEqual(exports_.inject, ['slots', 'locale', 'remote', 'remote.account'], 'exports.inject')

// --- Fake client Cordis context. ---------------------------------------------
const calls = { injected: [], registered: [], effects: [] }
let balanceResult = {
	ok: true,
	value: { status: 'ready', value: [{ currency: 'CNY', balance: '42.50' }], bonusWallets: [] },
}
const remote = {
	account: {
		getBalance: async (client) => {
			calls.balanceArgs = client
			return balanceResult
		},
	},
}
const ctx = {
	effect: (fn, label) => { calls.effects.push(label); return fn() },
	get: (name) => (name === 'remote' ? remote : name === 'locale' ? { getSnapshot: () => ({ active: 'zh' }) } : undefined),
	slots: {
		inject: (slot, callback) => { calls.injected.push(slot); return callback() },
		register: (spec, component) => { calls.registered.push({ spec, component }); return () => {} },
	},
}

exports_.apply(ctx)
assert.deepEqual(calls.injected, ['shell.overlay'], 'injects into the overlay slot')
assert.equal(calls.registered.length, 1, 'registers exactly one occupant')
assert.equal(calls.registered[0].spec.name, 'shell.overlay')
assert.equal(calls.registered[0].spec.id, 'deepseek-balance-float')
assert.ok(calls.effects.some((label) => label.includes('deepseek-balance-float')), 'registers through ctx.effect')
assert.equal(sheets.length, 1, 'inserts exactly one stylesheet')
assert.ok(sheets[0].textContent.includes('.dsh-balance-float'), 'stylesheet carries the widget rules')

// --- Render the component tree to prove it does not throw. -------------------
// `useEffect` is a no-op in this stub, so the first render is the loading state.
const walk = (node, out = []) => {
	if (node === null || typeof node !== 'object') return out
	out.push(node)
	for (const child of node.children ?? []) walk(child, out)
	return out
}

const loadingTree = calls.registered[0].component({})
const loadingNodes = walk(loadingTree)
assert.ok(loadingNodes.length > 3, 'renders a non-trivial tree')
const card = loadingNodes.find((n) => n.props?.className === 'dsh-balance-float')
assert.ok(card !== undefined, 'renders the card container')
assert.equal(typeof card.props.onClick, 'function', 'the whole card is refresh-clickable')
assert.ok(String(card.props.title).includes('单击刷新'), 'the card advertises click-to-refresh')
assert.ok(loadingNodes.some((n) => n.children?.includes('正在读取余额…')), 'shows the loading line before the first read')
assert.equal(typeof exports_.__internals?.formatAmount, 'function', 'exposes the amount formatter for tests')

// --- The amount reading is fixed to exactly three decimals. ------------------
const { formatAmount, normalize } = exports_.__internals
assert.equal(formatAmount('42.50'), '42.500', 'pads a short reading')
assert.equal(formatAmount('1.2394'), '1.239', 'truncates an over-long reading')
assert.equal(formatAmount('0'), '0.000', 'renders a zero balance')
assert.equal(formatAmount('1234.5678'), '1234.568', 'rounds at the third decimal')
assert.equal(formatAmount('n/a'), 'n/a', 'shows an unparsable reading verbatim')

const normalized = normalize({
	ok: true,
	value: {
		status: 'ready',
		value: [{ currency: 'CNY', balance: '1.2394' }],
		bonusWallets: [{ currency: 'CNY', balance: '5' }],
	},
})
assert.equal(normalized.kind, 'ready', 'a ready payload normalizes')
assert.equal(formatAmount(normalized.main.balance), '1.239', 'the main wallet is trimmed')
assert.equal(formatAmount(normalized.extras[0].balance), '5.000', 'bonus wallets use the same formatter')

// --- The read path returns the expected normalized shape. --------------------
const result = await remote.account.getBalance({ version: '0.1.0', locale: 'zh', timezoneOffsetSeconds: 0 })
assert.equal(result.value.value[0].balance, '42.50', 'balance passes through')
assert.ok(calls.balanceArgs.version !== undefined, 'client metadata carries a version')

balanceResult = { ok: false, error: { code: 'unauthorized' } }
const denied = await remote.account.getBalance({ version: '0.1.0', locale: 'zh', timezoneOffsetSeconds: 0 })
assert.equal(denied.ok, false, 'a refused call stays observable')

// --- Boot-safety scenario: no DOM at all, and a context without services. -----
delete globalThis.document
let hostileFactory = null
globalThis.window.__ModuleLoader__ = { load: (registration) => { hostileFactory = registration.factory } }
new Function('window', source)(globalThis.window)
const hostile = hostileFactory((id) => {
	if (id === 'react') return React
	throw new Error(`unexpected external module request: ${id}`)
})
assert.doesNotThrow(() => hostile.apply({}), 'apply survives a context with no services')
assert.doesNotThrow(() => hostile.apply({ effect: () => {}, slots: undefined }), 'apply survives a missing slot registry')
assert.doesNotThrow(() => hostile.apply({ effect: (fn) => fn(), slots: { inject: () => {}, register: () => () => {} } }), 'apply survives a missing document')

// --- The Host half is real ESM with the shape the Loader mounts. --------------
const host = await import(new URL('../lib/index.js', import.meta.url))
assert.equal(typeof host.apply, 'function', 'host exports apply')
assert.ok(Array.isArray(host.inject), 'host exports an inject list')
assert.doesNotThrow(() => host.apply(undefined), 'host apply is inert')

console.log('contract check passed')
