const SAMPLE_LIMIT = 120;
const LONG_TASK_LIMIT = 100;
const DIAGNOSTIC_MS = 10000;

const frameStalls = [];
const longTasks = [];
let lastFrame;
let sampling = false;

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
					pushLimited(longTasks, {
						at: entry.startTime,
						duration: entry.duration,
						name: entry.name || 'main thread',
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
				try {
					return original.apply(this, args);
				} finally {
					const duration = performance.now() - started;
					if (duration >= 2) {
						measurements.push({ event, duration, callback: original.name || 'anonymous' });
					}
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

function formatDuration(value) {
	return `${value.toFixed(1)} ms`;
}

function renderReport(beforeFrames, beforeTasks, afterFrames, afterTasks, hooks, startedAt) {
	const frames = [...beforeFrames, ...afterFrames].sort((a, b) => b.duration - a.duration);
	const tasks = [...beforeTasks, ...afterTasks].sort((a, b) => b.duration - a.duration);
	const hookTotals = new Map();
	for (const entry of hooks) {
		const key = `${entry.event} / ${entry.callback}`;
		hookTotals.set(key, (hookTotals.get(key) ?? 0) + entry.duration);
	}
	const hooksByCost = [...hookTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
	const content = document.createElement('div');
	content.className = 'pf2-director-performance-report';
	const title = document.createElement('p');
	title.textContent = `Captured ${DIAGNOSTIC_MS / 1000} seconds beginning at ${new Date(startedAt).toLocaleTimeString()}. Results are local to this browser. `;
	content.append(title);
	const sections = [
		['Longest main-thread tasks', tasks.slice(0, 8).map((entry) => `${formatDuration(entry.duration)} — ${entry.name}`)],
		['Largest frame stalls', frames.slice(0, 8).map((entry) => formatDuration(entry.duration))],
		['Slow Foundry hook callbacks', hooksByCost.map(([name, duration]) => `${formatDuration(duration)} total — ${name}`)],
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
	const startedAt = Date.now();
	ui.notifications.info('PF2 Director | Monitoring performance for 10 seconds. Reproduce the lag now.');
	await new Promise((resolve) => window.setTimeout(resolve, DIAGNOSTIC_MS));
	restoreHooks();
	const cutoff = performance.now() - DIAGNOSTIC_MS - 100;
	return renderReport(beforeFrames, beforeTasks, frameStalls.filter((entry) => entry.at >= cutoff), longTasks.filter((entry) => entry.at >= cutoff), hooks, startedAt);
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
