/**
 * Browser half of `dsh-deepseek-balance-float`.
 *
 * Renders one floating card into the frame-wide `shell.overlay` slot: the exact
 * DeepSeek account balance of the signed-in user, read through the generated
 * `ctx.remote.account.getBalance` Remote (never through an API key). The card
 * refreshes itself every ten seconds, can be refreshed with a left click, is
 * draggable by its header (geometry clamped to the viewport), and persists its
 * position plus open/closed state in `localStorage`.
 *
 * This file is a hand-written, dependency-free client bundle: it uses only the
 * platform module table (`react`) plus the Cordis context the Loader passes to
 * `apply`. It follows the same `window.__ModuleLoader__` envelope a compiled
 * TypeScript client half produces, so no bundler is required.
 *
 * Failure policy: the DSH web boot audit treats a failed client entry as a boot
 * failure and refuses to start the GUI. Every browser API touched here is
 * therefore optional and every entry point is wrapped, so a hostile environment
 * degrades to "no card" instead of "no app".
 */
window.__ModuleLoader__.load({
	id: "dsh-deepseek-balance-float",
	factory: (require) => {
		var module = { exports: {} }
		var exports = module.exports
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })

		const React = require("react")
		const h = React.createElement

		/**
		 * Live client plugin context, captured by {@link apply}. The module factory
		 * only receives `require`, so the component reads the services through this
		 * closure instead of through a render-time global.
		 */
		let ctx = null

		/** Slot this widget occupies. */
		const SLOT = "shell.overlay"
		/** Namespaced registration id inside that slot. */
		const ENTRY_ID = "deepseek-balance-float"
		/** Geometry/persistence key. */
		const STORE_KEY = "dsh-deepseek-balance-float/state/v1"
		/** Element id of this plugin's own stylesheet. */
		const STYLE_ID = "dsh-deepseek-balance-float/style"
		/** Version string carried in the account client metadata. */
		const CLIENT_VERSION = "0.1.0"
		/** Refresh cadence while the card is open (ms). */
		const AUTO_REFRESH_MS = 10 * 1000
		/** Decimal places every amount is rendered with. */
		const DECIMALS = 3
		/** Balance at or below which the amount is drawn in the warning colour. */
		const LOW_BALANCE = 10

		const CSS = `
.dsh-balance-float {
	position: fixed;
	z-index: 2147482000;
	width: 216px;
	user-select: none;
	-webkit-user-select: none;
	font-size: 12px;
	line-height: 1.45;
	color: var(--dsw-alias-label-primary, #e8e8ea);
	background: var(--dsw-alias-bg-overlay, #21212a);
	border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.14));
	border-radius: 12px;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.18);
	overflow: hidden;
	backdrop-filter: blur(8px);
	cursor: pointer;
}
.dsh-balance-float__head {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 10px 6px;
	cursor: grab;
	touch-action: none;
}
.dsh-balance-float__head:active { cursor: grabbing; }
.dsh-balance-float__dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	flex: none;
	background: var(--dsw-alias-state-idle-primary, #8a8a95);
}
.dsh-balance-float__dot[data-state="ready"] { background: var(--dsw-alias-state-success-primary, #3fbf7f); }
.dsh-balance-float__dot[data-state="stale"] { background: var(--dsw-alias-state-warn-primary, #e0a33e); }
.dsh-balance-float__dot[data-state="error"] { background: var(--dsw-alias-state-error-primary, #f2686b); }
.dsh-balance-float__title {
	flex: 1 1 auto;
	font-size: 11px;
	letter-spacing: 0.02em;
	color: var(--dsw-alias-label-secondary, #9a9aa6);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.dsh-balance-float__btn {
	flex: none;
	width: 20px;
	height: 20px;
	display: grid;
	place-items: center;
	padding: 0;
	border: 0;
	border-radius: 6px;
	color: var(--dsw-alias-label-secondary, #9a9aa6);
	background: transparent;
	cursor: pointer;
	font-size: 12px;
	line-height: 1;
}
.dsh-balance-float__btn:hover {
	color: var(--dsw-alias-label-primary, #e8e8ea);
	background: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.08));
}
.dsh-balance-float__body { padding: 0 10px 10px; }
.dsh-balance-float__amount {
	display: flex;
	align-items: baseline;
	gap: 4px;
	font-variant-numeric: tabular-nums;
}
.dsh-balance-float__value {
	font-size: 24px;
	font-weight: 600;
	letter-spacing: -0.01em;
}
.dsh-balance-float__cur { font-size: 12px; color: var(--dsw-alias-label-secondary, #9a9aa6); }
.dsh-balance-float__value[data-low="true"] { color: var(--dsw-alias-state-error-primary, #f2686b); }
.dsh-balance-float__line {
	margin-top: 2px;
	color: var(--dsw-alias-label-secondary, #9a9aa6);
	font-size: 11px;
}
.dsh-balance-float__error { color: var(--dsw-alias-state-error-primary, #f2686b); font-size: 11px; }
.dsh-balance-float__pill {
	position: fixed;
	z-index: 2147482000;
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 5px 10px;
	font-size: 12px;
	font-variant-numeric: tabular-nums;
	color: var(--dsw-alias-label-primary, #e8e8ea);
	background: var(--dsw-alias-bg-overlay, #21212a);
	border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.14));
	border-radius: 999px;
	box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
	cursor: grab;
	touch-action: none;
	user-select: none;
	-webkit-user-select: none;
}
.dsh-balance-float__pill:active { cursor: grabbing; }
.dsh-balance-float__pill .dsh-balance-float__cur { font-size: 11px; }
`

		/** @returns {Storage | null} local storage when the environment exposes a usable one. */
		function storage() {
			try {
				return window.localStorage ?? null
			} catch {
				return null
			}
		}

		/** @returns {Record<string, unknown>} the persisted geometry/visibility state. */
		function readStored() {
			try {
				const raw = storage()?.getItem(STORE_KEY)
				if (raw === null || raw === undefined) return {}
				const parsed = JSON.parse(raw)
				return parsed !== null && typeof parsed === "object" ? parsed : {}
			} catch {
				return {}
			}
		}

		/** @param {Record<string, unknown>} patch - fields to merge into the persisted state. */
		function writeStored(patch) {
			try {
				storage()?.setItem(STORE_KEY, JSON.stringify({ ...readStored(), ...patch }))
			} catch {
				/* private mode or quota: geometry simply stops persisting */
			}
		}

		/** @param {number} value @param {number} min @param {number} max @returns {number} value clamped into [min, max]. */
		function clamp(value, min, max) {
			return Math.min(Math.max(value, min), max)
		}

		/** @param {unknown} value @returns {value is Record<string, unknown>} whether the value is a plain-ish object. */
		function isRecord(value) {
			return typeof value === "object" && value !== null
		}

		/**
		 * Reduce any Remote result shape to one plain, render-safe model. The card
		 * must never crash a render, so every unexpected shape becomes `error`.
		 * @param {unknown} result - raw `ctx.remote.account.getBalance` result.
		 * @returns {{ kind: 'signed-out' } | { kind: 'error', message: string } | { kind: 'ready', main: { currency: string, balance: string }, extras: Array<{ currency: string, balance: string }> }}
		 */
		function normalize(result) {
			if (!isRecord(result)) return { kind: "error", message: "账号服务没有响应" }
			if (result.ok !== true) {
				return { kind: "error", message: "余额查询失败（账号服务拒绝了这次调用）" }
			}
			const value = result.value
			if (value === null) return { kind: "signed-out" }
			if (!isRecord(value)) return { kind: "error", message: "账号服务返回了意外的数据" }
			if (value.status === "failed") return { kind: "error", message: "余额查询失败" }
			if (value.status !== "ready") return { kind: "error", message: "账号服务返回了意外的状态" }
			const wallets = Array.isArray(value.value) ? value.value.filter(isRecord) : []
			const bonuses = Array.isArray(value.bonusWallets) ? value.bonusWallets.filter(isRecord) : []
			if (wallets.length === 0 && bonuses.length === 0) return { kind: "signed-out" }
			const pick = (w) => ({ currency: String(w.currency ?? ""), balance: String(w.balance ?? "") })
			const all = wallets.map(pick)
			const main = all.shift() ?? pick(bonuses[0] ?? {})
			return { kind: "ready", main, extras: [...all, ...bonuses.map(pick)] }
		}

		/** @param {string} currency @returns {string} the currency glyph. */
		function symbolOf(currency) {
			if (currency === "CNY") return "¥"
			if (currency === "USD") return "$"
			return currency === "" ? "" : `${currency} `
		}

		/** @param {string} amount @returns {number | null} the numeric reading, or null when unparsable. */
		function numeric(amount) {
			const parsed = Number.parseFloat(amount)
			return Number.isFinite(parsed) ? parsed : null
		}

		/**
		 * Render one wallet amount with a fixed number of decimals, so the card's
		 * width never jumps between refreshes. The API answers with an opaque
		 * decimal string, so a value it will not parse is shown verbatim.
		 * @param {string} amount - raw amount as the account service reported it.
		 * @returns {string} the display reading.
		 */
		function formatAmount(amount) {
			const parsed = numeric(amount)
			return parsed === null ? amount : parsed.toFixed(DECIMALS)
		}

		/**
		 * Read the account balance through the Host's generated account Remote.
		 * @returns {Promise<unknown>} the raw Remote result.
		 */
		async function readBalance() {
			const current = ctx
			const account = current === null || typeof current.get !== "function" ? undefined : current.get("remote")?.account
			if (account === null || account === undefined || typeof account.getBalance !== "function") {
				throw new Error("账号服务不可用：当前 Host 没有注册 account Remote")
			}
			const locale = current.get("locale")?.getSnapshot?.().active ?? "zh"
			return await account.getBalance({
				version: CLIENT_VERSION,
				locale,
				timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
			})
		}

		/**
		 * Own the widget's stylesheet. The dynamic package runtime exposes a
		 * `styles` helper while a static bundle does not, and the document may not
		 * be ready while the entry activates, so this is best-effort in both
		 * directions: it inserts one `<style>` element when it can and returns a
		 * disposer either way.
		 * @returns {() => void} disposer.
		 */
		function insertStyles() {
			const doc = typeof document === "undefined" ? null : document
			const head = doc === null ? null : doc.head
			if (head === null || head === undefined) return () => {}
			const previous = typeof doc.getElementById === "function" ? doc.getElementById(STYLE_ID) : null
			if (previous !== null && previous !== undefined && typeof previous.remove === "function") previous.remove()
			const element = doc.createElement("style")
			element.id = STYLE_ID
			element.textContent = CSS
			head.appendChild(element)
			return () => {
				try {
					element.remove()
				} catch {
					/* already detached */
				}
			}
		}

		/**
		 * One floating balance card. Rendered by the slot renderer with framework
		 * props this widget does not need, so the props bag stays unread.
		 */
		function BalanceFloat() {
			const stored = React.useRef(readStored()).current
			const [open, setOpen] = React.useState(stored.open !== false)
			const [pos, setPos] = React.useState(() => ({
				x: typeof stored.x === "number" ? stored.x : null,
				y: typeof stored.y === "number" ? stored.y : 96,
			}))
			const [state, setState] = React.useState({ loading: true, view: null, error: null, at: 0 })
			const cardRef = React.useRef(null)
			const dragRef = React.useRef(null)
			/** True once the current pointer gesture moved far enough to count as a drag. */
			const movedRef = React.useRef(false)
			/** True while a balance read is in flight, so the 10s tick cannot pile up calls. */
			const inFlightRef = React.useRef(false)

			/** Read the balance once; a rejected Promise is a transport failure, not an account failure. */
			const refresh = React.useCallback(async () => {
				if (inFlightRef.current) return
				inFlightRef.current = true
				setState((prev) => ({ ...prev, loading: true }))
				try {
					const result = await readBalance()
					setState({ loading: false, view: normalize(result), error: null, at: Date.now() })
				} catch (error) {
					setState({
						loading: false,
						view: null,
						error: error instanceof Error ? error.message : String(error),
						at: Date.now(),
					})
				} finally {
					inFlightRef.current = false
				}
			}, [])

			React.useEffect(() => {
				refresh()
			}, [refresh])

			React.useEffect(() => {
				if (!open) return undefined
				const timer = setInterval(() => { refresh() }, AUTO_REFRESH_MS)
				return () => { clearInterval(timer) }
			}, [open, refresh])

			// Keep a restored horizontal position inside the current viewport.
			React.useEffect(() => {
				if (pos.x === null) return
				const onResize = () => {
					const node = cardRef.current
					const width = node === null ? 0 : node.offsetWidth
					const height = node === null ? 0 : node.offsetHeight
					setPos((prev) => prev.x === null ? prev : {
						x: clamp(prev.x, 4, Math.max(4, window.innerWidth - width - 4)),
						y: clamp(prev.y, 4, Math.max(4, window.innerHeight - height - 4)),
					})
				}
				window.addEventListener("resize", onResize)
				return () => { window.removeEventListener("resize", onResize) }
			}, [pos.x])

			/** Begin a pointer drag; geometry is clamped to the viewport on every move. */
			const onPointerDown = React.useCallback((event) => {
				if (event.button !== 0) return
				const node = cardRef.current
				if (node === null) return
				const rect = node.getBoundingClientRect()
				dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, x: event.clientX, y: event.clientY }
				movedRef.current = false
				event.currentTarget.setPointerCapture?.(event.pointerId)
			}, [])

			const onPointerMove = React.useCallback((event) => {
				const drag = dragRef.current
				if (drag === null) return
				const node = cardRef.current
				const width = node === null ? 0 : node.offsetWidth
				const height = node === null ? 0 : node.offsetHeight
				if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 4) movedRef.current = true
				event.preventDefault()
				setPos({
					x: clamp(event.clientX - drag.dx, 4, Math.max(4, window.innerWidth - width - 4)),
					y: clamp(event.clientY - drag.dy, 4, Math.max(4, window.innerHeight - height - 4)),
				})
			}, [])

			const onPointerUp = React.useCallback(() => {
				if (dragRef.current === null) return
				dragRef.current = null
				setPos((prev) => {
					writeStored({ x: prev.x, y: prev.y })
					return prev
				})
			}, [])

			const close = React.useCallback(() => {
				setOpen(false)
				writeStored({ open: false })
			}, [])

			const reopen = React.useCallback(() => {
				setOpen(true)
				writeStored({ open: true })
			}, [])

			/**
			 * Left-click anywhere on the card refreshes the balance. A click that
			 * ended a drag, or that came from one of the header buttons (they stop
			 * propagation themselves), is not a refresh request.
			 * @param {MouseEvent} event - the click on the card.
			 */
			const onCardClick = React.useCallback((event) => {
				if (movedRef.current) return
				const target = event.target
				if (target instanceof Element && target.closest("button") !== null) return
				refresh()
			}, [refresh])

			const view = state.view
			const reading = view !== null && view.kind === "ready" ? formatAmount(view.main.balance) : null
			// Judge the threshold on the same reading the card shows, so a balance is
			// never highlighted as low while it is displayed as an amount above it.
			const amount = reading === null ? null : numeric(reading)
			const low = amount !== null && amount <= LOW_BALANCE
			const status = state.error !== null
				? "error"
				: state.loading
					? "stale"
					: view !== null && view.kind === "ready" ? "ready" : "error"

			if (!open) {
				return h("div", {
					ref: cardRef,
					className: "dsh-balance-float__pill",
					style: {
						right: pos.x === null ? 16 : "auto",
						left: pos.x === null ? "auto" : `${pos.x}px`,
						top: `${pos.y}px`,
					},
					title: "单击刷新余额（每 10 秒自动刷新），拖动可移动",
					onClick: () => { if (!movedRef.current) reopen() },
					onPointerDown: onPointerDown,
					onPointerMove: onPointerMove,
					onPointerUp: onPointerUp,
					onPointerCancel: onPointerUp,
				},
					h("span", { className: "dsh-balance-float__dot", "data-state": status }),
					h("span", null, view !== null && view.kind === "ready"
						? `${symbolOf(view.main.currency)}${formatAmount(view.main.balance)}`
						: "余额"),
				)
			}

			const body = state.error !== null
				? h("div", { className: "dsh-balance-float__error" }, "读取失败，点击刷新重试")
				: view === null
					? h("div", { className: "dsh-balance-float__line" }, state.loading ? "正在读取余额…" : "暂无数据")
					: view.kind === "signed-out"
						? h("div", { className: "dsh-balance-float__line" }, "未检测到已登录的 DeepSeek 账号")
						: view.kind === "error"
							? h("div", { className: "dsh-balance-float__error" }, view.message)
							: h(React.Fragment, null,
								h("div", { className: "dsh-balance-float__amount" },
									h("span", { className: "dsh-balance-float__cur" }, symbolOf(view.main.currency)),
									h("span", { className: "dsh-balance-float__value", "data-low": low ? "true" : "false" }, formatAmount(view.main.balance)),
								),
								view.extras.length > 0
									? h("div", { className: "dsh-balance-float__line" },
										"赠送余额 ",
										view.extras.map((wallet, index) => h("span", { key: index },
											index > 0 ? " · " : "",
											`${symbolOf(wallet.currency)}${formatAmount(wallet.balance)}`,
										)),
									)
									: null,
								state.at > 0
									? h("div", { className: "dsh-balance-float__line" },
										`更新于 ${new Date(state.at).toLocaleTimeString()}`,
									)
									: null,
							)

			return h("div", {
				ref: cardRef,
				className: "dsh-balance-float",
				title: "单击刷新余额（每 10 秒自动刷新），拖动标题栏可移动",
				style: {
					right: pos.x === null ? 16 : "auto",
					left: pos.x === null ? "auto" : `${pos.x}px`,
					top: `${pos.y}px`,
				},
				onClick: onCardClick,
			},
				h("div", {
					className: "dsh-balance-float__head",
					onPointerDown: onPointerDown,
					onPointerMove: onPointerMove,
					onPointerUp: onPointerUp,
					onPointerCancel: onPointerUp,
				},
					h("span", { className: "dsh-balance-float__dot", "data-state": status }),
					h("span", { className: "dsh-balance-float__title" }, "DeepSeek 余额"),
					h("button", {
						type: "button",
						className: "dsh-balance-float__btn",
						title: "刷新",
						"aria-label": "刷新余额",
						onPointerDown: (event) => { event.stopPropagation() },
						onClick: (event) => { event.stopPropagation(); refresh() },
					}, state.loading ? "…" : "⟳"),
					h("button", {
						type: "button",
						className: "dsh-balance-float__btn",
						title: "收起为小挂件",
						"aria-label": "收起余额悬浮窗",
						onPointerDown: (event) => { event.stopPropagation() },
						onClick: (event) => { event.stopPropagation(); close() },
					}, "—"),
				),
				h("div", { className: "dsh-balance-float__body" }, body),
			)
		}

		/**
		 * Required client services: the slot registry, the locale preference used in
		 * the account request, and the account Remote itself.
		 */
		const inject = ["slots", "locale", "remote", "remote.account"]

		/**
		 * Register the widget into the frame-wide overlay layer.
		 *
		 * The whole body is guarded on purpose: the DSH web boot audit treats a
		 * failed client entry as a boot failure and refuses to start the GUI, so a
		 * widget problem must degrade to "no card", never to "no app".
		 *
		 * @param {any} pluginCtx - the client Cordis context of this entry's fiber.
		 */
		function apply(pluginCtx) {
			try {
				ctx = pluginCtx
				if (typeof ctx?.effect !== "function" || typeof ctx?.slots?.inject !== "function") {
					console.error("[deepseek-balance-float] slot registry unavailable; widget not registered")
					return
				}
				ctx.effect(insertStyles, "deepseek-balance-float: stylesheet")
				ctx.effect(() => ctx.slots.inject(SLOT, () => ctx.slots.register(
					{ name: SLOT, id: ENTRY_ID, order: 60, label: "DeepSeek 余额" },
					BalanceFloat,
				)), "deepseek-balance-float: overlay widget")
			} catch (error) {
				console.error("[deepseek-balance-float] registration failed", error)
			}
		}

		exports.inject = inject
		exports.apply = apply
		/**
		 * Pure helpers, exported for the offline contract check only. The package
		 * is never published, so this extra member costs nothing at runtime and
		 * keeps the amount/state rules testable without a DOM.
		 */
		exports.__internals = { formatAmount, normalize }
		return module.exports
	},
})
