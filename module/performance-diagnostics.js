const SAMPLE_LIMIT = 120;
const LONG_TASK_LIMIT = 100;
const DIAGNOSTIC_MS = 10000;
const DIAGNOSTIC_MODULE_ID = 'pf2-david-music-control';

const frameStalls = [];
const longTasks = [];
let lastFrame;
let sampling = false;
const callbackOwners = new WeakMap();
let activeCallbackCapture = null;
let activeEventTimeline = null;
let activeHookContext = null;

function ownerFromStack(stack = '') {
	const moduleMatches = [...stack.matchAll(/(?:https?:\/\/[^/]+)?\/modules\/([^/\s?#]+)/gi)];
	const moduleMatch = moduleMatches.find((match) => match[1] !== DIAGNOSTIC_MODULE_ID);
	if (moduleMatch) return moduleMatch[1];
	const systemMatch = stack.match(/(?:https?:\/\/[^/]+)?\/systems\/([^/\s?#]+)/i);
	if (systemMatch) return `system:${systemMatch[1]}`;
	return 'unattributed';
}

function sourceFromStack(stack = '') {
	return stack
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !line.includes('performance-diagnostics.js'))
		.find((line) => /(?:\/modules\/|\/systems\/|foundry\.)/i.test(line)) ?? 'source unavailable';
}

function captureRegistrationMetadata() {
	const stack = new Error().stack ?? '';
	return { owner: ownerFromStack(stack), source: sourceFromStack(stack) };
}

function installHookRegistrationTracking() {
	const hooks = globalThis.Hooks;
	if (!hooks || hooks.__pf2DirectorTrackingInstalled) return;
	hooks.__pf2DirectorTrackingInstalled = true;
	for (const methodName of ['on', 'once']) {
		if (typeof hooks[methodName] !== 'function') continue;
		const original = hooks[methodName];
		hooks[methodName] = function trackedHookRegistration(event, callback, ...args) {
			if (typeof callback === 'function') callbackOwners.set(callback, captureRegistrationMetadata());
			return original.call(this, event, callback, ...args);
		};
	}
}

installHookRegistrationTracking();

function installHookEventTracking() {
	const hooks = globalThis.Hooks;
	if (!hooks || hooks.__pf2DirectorEventTrackingInstalled) return;
	hooks.__pf2DirectorEventTrackingInstalled = true;
	for (const methodName of ['call', 'callAll', 'callAsync']) {
		if (typeof hooks[methodName] !== 'function') continue;
		const original = hooks[methodName];
		hooks[methodName] = function trackedHookCall(event, ...args) {
			if (activeEventTimeline && typeof event === 'string') {
				pushLimited(activeEventTimeline, { at: performance.now(), event, method: methodName }, 120);
			}
			return original.call(this, event, ...args);
		};
	}
}

installHookEventTracking();

function installAsyncCallbackTracking() {
	const target = globalThis.window ?? globalThis;
	if (target.__pf2DirectorAsyncTrackingInstalled) return;
	target.__pf2DirectorAsyncTrackingInstalled = true;
	const registrations = [
		['setTimeout', 'timer'],
		['setInterval', 'interval'],
		['requestAnimationFrame', 'animation frame'],
	];
	for (const [methodName, type] of registrations) {
		const original = target[methodName];
		if (typeof original !== 'function') continue;
		target[methodName] = function trackedAsyncRegistration(callback, ...args) {
			if (typeof callback !== 'function') return original.call(this, callback, ...args);
			const metadata = captureRegistrationMetadata();
			if (metadata.owner === DIAGNOSTIC_MODULE_ID) return original.call(this, callback, ...args);
			const wrapped = function trackedAsyncCallback(...callbackArgs) {
				const started = performance.now();
				try {
					return callback.apply(this, callbackArgs);
				} finally {
					const duration = performance.now() - started;
					if (activeCallbackCapture && duration >= 2) {
						activeCallbackCapture.push({ type, ...metadata, duration, callback: callback.name || 'anonymous' });
					}
				}
			};
			return original.call(this, wrapped, ...args);
		};
	}
}

installAsyncCallbackTracking();

function pushLimited(list, value, limit) {
	list.push(value);
	if (list.length > limit) list.splice(0, list.length - limit);
}

function sampleFrame(now) {
	if (lastFrame !== undefined) {
		const duration = now - lastFrame;
		if (duration >= 50) pushLimited(frameStalls, { at: now, duration }, SAMPLE_LIMIT);
	}
	lastFrame = now;
	window.requestAnimationFrame(sampleFrame);
}

function startRollingSampler() {
	if (sampling) return;
	sampling = true;
	window.requestAnimationFrame(sampleFrame);
	if ('PerformanceObserver' in window) {
		try {
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					const attribution = Array.isArray(entry.attribution)
						? entry.attribution.map((item) => item.containerName || item.name).filter(Boolean)
						: [];
					pushLimited(longTasks, {
						at: entry.startTime,
						duration: entry.duration,
						name: entry.name === 'self' || !entry.name ? 'Unattributed browser main-thread task' : entry.name,
						attribution,
					}, LONG_TASK_LIMIT);
				}
			}).observe({ type: 'longtask', buffered: true });
		} catch (_error) {
			// Long Task timing is not available in every browser.
		}
	}
}

function hookEntries() {
	const events = globalThis.Hooks?.events;
	if (!events) return [];
	if (events instanceof Map) return [...events.entries()];
	return Object.entries(events);
}

function instrumentHooks(measurements) {
	const originals = [];
	for (const [event, callbacks] of hookEntries()) {
		if (!Array.isArray(callbacks)) continue;
		for (let index = 0; index < callbacks.length; index += 1) {
			const original = callbacks[index];
			if (typeof original !== 'function' || original.__pf2DirectorDiagnostic) continue;
			const wrapped = function diagnosticHookWrapper(...args) {
				const started = performance.now();
				const previousContext = activeHookContext;
				const metadata = callbackOwners.get(original) ?? { owner: 'unattributed', source: 'source unavailable' };
				activeHookContext = { event, owner: metadata.owner, source: metadata.source };
				try {
					return original.apply(this, args);
				} finally {
					const duration = performance.now() - started;
					if (duration >= 2) {
						measurements.push({
							event,
							duration,
							at: performance.now(),
							owner: metadata.owner,
							source: metadata.source,
							callback: original.name || 'anonymous',
						});
					}
					activeHookContext = previousContext;
				}
			};
			wrapped.__pf2DirectorDiagnostic = true;
			callbacks[index] = wrapped;
			originals.push({ callbacks, index, original, wrapped });
		}
	}
	return () => originals.forEach(({ callbacks, index, original, wrapped }) => {
		if (callbacks[index] === wrapped) callbacks[index] = original;
	});
}

function instrumentRuntimeMethods(measurements) {
	const patches = [];
	const seen = new Set();
	const candidates = [];
	const addCandidate = (target, label) => {
		if (target && typeof target === 'object') candidates.push([target, label]);
	};
	const addMethods = (target, labels, prefix) => {
		if (!target) return;
		for (const method of labels) addCandidate(target, prefix ? `${prefix}.${method}` : method);
	};

	addMethods(globalThis.PIXI?.Ticker?.prototype, ['update', '_tick'], 'PIXI.Ticker.prototype');
	addCandidate(globalThis.canvas?.app, 'canvas.app.render');
	addCandidate(globalThis.canvas?.renderer, 'canvas.renderer.render');
	addCandidate(globalThis.canvas?.perception, 'canvas.perception.update');
	addMethods(globalThis.foundry?.applications?.api?.ApplicationV2?.prototype, ['render', '_renderFrame'], 'ApplicationV2.prototype');
	addMethods(globalThis.CONFIG?.Actor?.documentClass?.prototype, ['prepareData', 'prepareDerivedData'], 'Actor.prototype');
	addMethods(globalThis.CONFIG?.Token?.objectClass?.prototype, ['refresh', 'initializeVisionSource'], 'Token.prototype');

	for (const [target, label] of candidates) {
		const method = label.includes('.') ? label.split('.').pop() : label;
		if (seen.has(`${label}:${method}`) || typeof target[method] !== 'function') continue;
		seen.add(`${label}:${method}`);
		const original = target[method];
		const wrapped = function diagnosticRuntimeMethod(...args) {
			const started = performance.now();
			try {
				return original.apply(this, args);
			} finally {
				const duration = performance.now() - started;
				if (duration >= 2) {
					const callStack = new Error().stack ?? '';
					measurements.push({
						owner: 'Foundry runtime',
						source: label,
						callSource: sourceFromStack(callStack),
						hookContext: activeHookContext ? `${activeHookContext.owner} / ${activeHookContext.event} (${activeHookContext.source})` : 'No active hook context',
						type: 'runtime method',
						duration,
						callback: method,
					});
				}
			}
		};
		target[method] = wrapped;
		patches.push({ target, method, original, wrapped });
	}
	return () => patches.forEach(({ target, method, original, wrapped }) => {
		if (target[method] === wrapped) target[method] = original;
	});
}

function formatDuration(value) {
	return `${value.toFixed(1)} ms`;
}

function getSceneMetrics() {
	const scene = globalThis.canvas?.scene;
	const actorCounts = [...(globalThis.game?.actors?.contents ?? [])].reduce((total, actor) => total + (actor.items?.size ?? actor.items?.contents?.length ?? 0), 0);
	const effectCounts = [...(globalThis.game?.actors?.contents ?? [])].reduce((total, actor) => total + (actor.effects?.size ?? actor.effects?.contents?.length ?? 0), 0);
	return {
		scene: scene?.name ?? 'No active scene',
		tokens: canvas?.tokens?.placeables?.length ?? 0,
		walls: scene?.walls?.size ?? scene?.walls?.contents?.length ?? 0,
		lights: scene?.lights?.size ?? scene?.lights?.contents?.length ?? 0,
		templates: scene?.templates?.size ?? scene?.templates?.contents?.length ?? 0,
		actors: game?.actors?.size ?? game?.actors?.contents?.length ?? 0,
		items: actorCounts,
		effects: effectCounts,
		chatMessages: game?.messages?.size ?? game?.messages?.contents?.length ?? 0,
	};
}

function renderReport(beforeFrames, beforeTasks, afterFrames, afterTasks, hooks, asyncCallbacks, runtimeCallbacks, eventTimeline, sceneMetrics, startedAt) {
	const frames = [...beforeFrames, ...afterFrames].sort((a, b) => b.duration - a.duration);
	const tasks = [...beforeTasks, ...afterTasks].sort((a, b) => b.duration - a.duration);
	const hookTotals = new Map();
	for (const entry of hooks) {
		const key = `${entry.owner} / ${entry.event} / ${entry.callback}`;
		const current = hookTotals.get(key) ?? { total: 0, max: 0, count: 0, source: entry.source };
		current.total += entry.duration;
		current.max = Math.max(current.max, entry.duration);
		current.count += 1;
		hookTotals.set(key, current);
	}
	const hooksByCost = [...hookTotals.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
	const content = document.createElement('div');
	content.className = 'pf2-director-performance-report';
	const title = document.createElement('p');
	title.textContent = `Captured ${DIAGNOSTIC_MS / 1000} seconds beginning at ${new Date(startedAt).toLocaleTimeString()}. Results are local to this browser. `;
	content.append(title);
	const asyncTotals = new Map();
	for (const entry of asyncCallbacks) {
		const key = `${entry.owner} / ${entry.type} / ${entry.callback}`;
		const current = asyncTotals.get(key) ?? { total: 0, max: 0, count: 0, source: entry.source };
		current.total += entry.duration;
		current.max = Math.max(current.max, entry.duration);
		current.count += 1;
		asyncTotals.set(key, current);
	}
	const asyncByCost = [...asyncTotals.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
	const runtimeTotals = new Map();
	for (const entry of runtimeCallbacks) {
		const key = `${entry.source} / ${entry.callback} / ${entry.callSource} / ${entry.hookContext}`;
		const current = runtimeTotals.get(key) ?? {
			total: 0,
			max: 0,
			count: 0,
			source: `${entry.source} / ${entry.callback}; caller: ${entry.callSource}; context: ${entry.hookContext}`,
		};
		current.total += entry.duration;
		current.max = Math.max(current.max, entry.duration);
		current.count += 1;
		runtimeTotals.set(key, current);
	}
	const runtimeByCost = [...runtimeTotals.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
	const describeCallback = ([name, data]) => `${formatDuration(data.total)} total; max ${formatDuration(data.max)}; ${data.count} call${data.count === 1 ? '' : 's'} — ${name} (${data.source})`;
	const metricsText = Object.entries(sceneMetrics).map(([key, value]) => `${key}: ${value}`).join(' · ');
	const nearbyEvents = frames.slice(0, 8).map((frame) => {
		const events = eventTimeline
			.filter((entry) => entry.at <= frame.at && frame.at - entry.at <= 1500)
			.slice(-4)
			.map((entry) => entry.event);
		return `${formatDuration(frame.duration)} — ${events.length ? [...new Set(events)].join(', ') : 'No recent hook event recorded'}`;
	});
	const sections = [
		['Scene snapshot', [metricsText]],
		['Longest main-thread tasks', tasks.slice(0, 8).map((entry) => {
			const source = entry.attribution?.length ? ` (${entry.attribution.join(', ')})` : '';
			return `${formatDuration(entry.duration)} — ${entry.name}${source}`;
		})],
		['Largest frame stalls', frames.slice(0, 8).map((entry) => formatDuration(entry.duration))],
		['Slow Foundry hook callbacks', hooksByCost.map(describeCallback)],
		['Slow module timers and animation callbacks', asyncByCost.map(describeCallback)],
		['Slow Foundry runtime methods', runtimeByCost.map(describeCallback)],
		['Hook events near largest frame stalls', nearbyEvents],
	];
	for (const [heading, values] of sections) {
		const h = document.createElement('h3');
		h.textContent = heading;
		content.append(h);
		const list = document.createElement('ul');
		if (!values.length) {
			const item = document.createElement('li');
			item.textContent = 'No significant activity measured.';
			list.append(item);
		} else {
			for (const value of values) {
				const item = document.createElement('li');
				item.textContent = value;
				list.append(item);
			}
		}
		content.append(list);
	}
	const note = document.createElement('p');
	note.className = 'hint';
	note.textContent = 'Long tasks cannot always be assigned to a specific module by the browser. Hook entries are clues, not proof; system, rendering, and hardware work may remain unattributed.';
	content.append(note);
	return content.outerHTML;
}

export async function runPerformanceDiagnostic() {
	startRollingSampler();
	const beforeFrames = frameStalls.filter((entry) => entry.at >= performance.now() - 3000);
	const beforeTasks = longTasks.filter((entry) => entry.at >= performance.now() - 3000);
	const hooks = [];
	const restoreHooks = instrumentHooks(hooks);
	const asyncCallbacks = [];
	const runtimeCallbacks = [];
	const eventTimeline = [];
	const sceneMetrics = getSceneMetrics();
	const restoreRuntime = instrumentRuntimeMethods(runtimeCallbacks);
	activeCallbackCapture = asyncCallbacks;
	activeEventTimeline = eventTimeline;
	const startedAt = Date.now();
	ui.notifications.info('PF2 Director | Monitoring performance for 10 seconds. Reproduce the lag now.');
	await new Promise((resolve) => window.setTimeout(resolve, DIAGNOSTIC_MS));
	restoreHooks();
	restoreRuntime();
	activeCallbackCapture = null;
	activeEventTimeline = null;
	const cutoff = performance.now() - DIAGNOSTIC_MS - 100;
	return renderReport(beforeFrames, beforeTasks, frameStalls.filter((entry) => entry.at >= cutoff), longTasks.filter((entry) => entry.at >= cutoff), hooks, asyncCallbacks, runtimeCallbacks, eventTimeline, sceneMetrics, startedAt);
}

export function buildPerformanceDiagnosticsRow() {
	const wrapper = document.createElement('div');
	wrapper.className = 'form-group dmc-performance-diagnostics-row';
	wrapper.innerHTML = '<label>Performance Diagnostic</label><div class="form-fields"><button type="button"><i class="fas fa-gauge-high"></i> Run 10-Second Diagnostic</button></div><p class="hint">Captures recent and live frame stalls, long tasks, and slow Foundry hooks. Reproduce the lag after clicking.</p>';
	wrapper.querySelector('button').addEventListener('click', async (event) => {
		const button = event.currentTarget;
		button.disabled = true;
		try {
			const report = await runPerformanceDiagnostic();
			new Dialog({ title: 'PF2 Director Performance Diagnostic', content: report, buttons: { close: { label: 'Close' } }, default: 'close' }).render(true);
		} catch (error) {
			console.error('PF2 Director | Performance diagnostic failed', error);
			ui.notifications.error('PF2 Director | Performance diagnostic failed. See the browser console.');
		} finally {
			button.disabled = false;
		}
	});
	return wrapper;
}

Hooks.once('ready', startRollingSampler);
