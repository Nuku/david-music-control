import { MODULE_ID, getSetting } from './settings.js';

// The original Token vision source is reused for the first corner. Three
// additional sources complete the four-corner view without retaining a
// center-anchored source.
const CORNER_SOURCE_COUNT = 3;
const CORNER_INSET_PIXELS = 1;
const WALL_CLEARANCE_PIXELS = 1;
const CORNER_SOURCE_KEY = Symbol('pf2DirectorEnhancedVisionSources');
const DEBUG_DATA_KEY = Symbol('pf2DirectorEnhancedVisionDebugData');
let debugOverlay;

function isEnabled() {
	try {
		return Boolean(getSetting('enhancedVision'));
	} catch (_error) {
		return false;
	}
}

function isDebugEnabled() {
	try {
		return Boolean(getSetting('enhancedVisionDebug'));
	} catch (_error) {
		return false;
	}
}

function getCornerPoints(token) {
	const x = Number(token.document?.x ?? token.x ?? 0);
	const y = Number(token.document?.y ?? token.y ?? 0);
	const width = Number(token.w ?? 0);
	const height = Number(token.h ?? 0);
	const inset = Math.min(CORNER_INSET_PIXELS, Math.abs(width) / 2, Math.abs(height) / 2);
	const points = [
		{ x: x + inset, y: y + inset },
		{ x: x + width - inset, y: y + inset },
		{ x: x + width - inset, y: y + height - inset },
		{ x: x + inset, y: y + height - inset },
	];
	const rotation = Number(token.document?.rotation ?? 0);
	if (!rotation) return points;

	const radians = (rotation * Math.PI) / 180;
	const center = { x: x + width / 2, y: y + height / 2 };
	return points.map((point) => {
		const dx = point.x - center.x;
		const dy = point.y - center.y;
		return {
			x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
			y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians),
		};
	});
}

function getTokenCenter(token) {
	if (typeof token.getCenterPoint === 'function') return token.getCenterPoint();
	return {
		x: Number(token.document?.x ?? token.x ?? 0) + Number(token.w ?? 0) / 2,
		y: Number(token.document?.y ?? token.y ?? 0) + Number(token.h ?? 0) / 2,
	};
}

function getWallSafeCornerPoint(token, center, corner) {
	const CollisionPolygon = foundry.canvas.geometry?.ClockwiseSweepPolygon;
	if (typeof CollisionPolygon?.testCollision !== 'function') return { point: corner, collision: null };

	const config = { mode: 'closest', type: 'sight' };
	if (token.vision?.level) config.level = token.vision.level;
	let collision;
	try {
		collision = CollisionPolygon.testCollision(center, corner, config);
	} catch (error) {
		console.warn(`[${MODULE_ID}] Enhanced Vision could not test the center-to-corner ray`, error);
		return { point: corner, collision: null };
	}
	if (!collision || !Number.isFinite(collision.x) || !Number.isFinite(collision.y)) return { point: corner, collision: null };

	const dx = collision.x - center.x;
	const dy = collision.y - center.y;
	const distance = Math.hypot(dx, dy);
	if (!distance) return { point: center, collision };
	const safeDistance = Math.max(0, distance - WALL_CLEARANCE_PIXELS);
	return {
		point: {
			x: center.x + (dx / distance) * safeDistance,
			y: center.y + (dy / distance) * safeDistance,
		},
		collision,
	};
}

function clearDebugOverlay() {
	debugOverlay?.destroy?.();
	debugOverlay = null;
}

function getDebugOverlay() {
	if (debugOverlay || !globalThis.PIXI?.Graphics) return debugOverlay;
	const parent = canvas?.interface ?? canvas?.controls ?? canvas?.stage;
	if (!parent) return null;
	debugOverlay = new PIXI.Graphics();
	debugOverlay.zIndex = 10000;
	parent.addChild(debugOverlay);
	return debugOverlay;
}

function drawDebugMarker(graphics, point, color, radius = 3) {
	graphics.beginFill(color, 0.9).drawCircle(point.x, point.y, radius).endFill();
}

function drawDebugOverlay() {
	clearDebugOverlay();
	if (!isEnabled() || !isDebugEnabled()) return;
	const graphics = getDebugOverlay();
	if (!graphics) return;
	for (const token of canvas?.tokens?.placeables ?? []) {
		const debug = token[DEBUG_DATA_KEY];
		if (!debug) continue;
		drawDebugMarker(graphics, debug.center, 0xffffff, 4);
		for (const entry of debug.corners) {
			graphics.lineStyle(1, 0xffff00, 0.75).moveTo(debug.center.x, debug.center.y).lineTo(entry.corner.x, entry.corner.y);
			drawDebugMarker(graphics, entry.corner, 0xffff00, 3);
			if (entry.collision) {
				graphics.lineStyle(2, 0xff3333, 0.9).moveTo(debug.center.x, debug.center.y).lineTo(entry.collision.x, entry.collision.y);
				drawDebugMarker(graphics, entry.collision, 0xff3333, 3);
			}
			drawDebugMarker(graphics, entry.point, 0x33ff66, 3);
		}
	}
}

function logDebugData(token, center, corners) {
	if (!isDebugEnabled()) return;
	console.groupCollapsed(`[${MODULE_ID}] Enhanced Vision: ${token.name ?? token.id}`);
	console.log('center', center);
	console.table(corners.map((entry, index) => ({
		corner: index + 1,
		intendedX: entry.corner.x,
		intendedY: entry.corner.y,
		collisionX: entry.collision?.x ?? null,
		collisionY: entry.collision?.y ?? null,
		viewpointX: entry.point.x,
		viewpointY: entry.point.y,
	})));
	console.groupEnd();
}

function destroyCornerSources(token) {
	for (const source of token[CORNER_SOURCE_KEY] ?? []) {
		try {
			source.destroy();
		} catch (error) {
			console.warn(`[${MODULE_ID}] Failed to destroy an Enhanced Vision source`, error);
		}
	}
	delete token[CORNER_SOURCE_KEY];
}

function updateCornerSources(token) {
	const vision = token.vision;
	if (!vision || !isEnabled()) {
		destroyCornerSources(token);
		return;
	}

	const data = foundry.utils.deepClone(vision.data ?? {});
	const center = getTokenCenter(token);
	const corners = getCornerPoints(token).map((corner) => ({
		corner,
		...getWallSafeCornerPoint(token, center, corner),
	}));
	token[DEBUG_DATA_KEY] = { center, corners };
	logDebugData(token, center, corners);
	drawDebugOverlay();
	const points = corners.map((entry) => entry.point);
	vision.initialize({ ...data, x: points[0].x, y: points[0].y });
	const sources = token[CORNER_SOURCE_KEY] ?? [];
	for (let index = 0; index < CORNER_SOURCE_COUNT; index += 1) {
		const point = points[index + 1];
		const sourceData = { ...data, x: point.x, y: point.y };
		let source = sources[index];
		if (!source) {
			const PointVisionSource = foundry.canvas.sources?.PointVisionSource;
			if (!PointVisionSource) return;
			source = new PointVisionSource({
				object: token,
				sourceId: `${token.sourceId}-enhanced-${index}`,
			});
			sources[index] = source;
		}
		source.initialize(sourceData);
		if (!source.attached) source.add();
	}
	token[CORNER_SOURCE_KEY] = sources;
}

Hooks.once('init', () => {
	const TokenClass = CONFIG.Token?.objectClass;
	if (!TokenClass?.prototype?.initializeVisionSource) {
		console.warn(`[${MODULE_ID}] Enhanced Vision could not find the Token vision lifecycle.`);
		return;
	}

	const originalInitializeVisionSource = TokenClass.prototype.initializeVisionSource;
	TokenClass.prototype.initializeVisionSource = function enhancedVisionInitialize(options = {}) {
		if (options.deleted) destroyCornerSources(this);
		const result = originalInitializeVisionSource.call(this, options);
	if (!options.deleted) updateCornerSources(this);
		return result;
	};
});

Hooks.on('canvasTearDown', clearDebugOverlay);

Hooks.on('canvasReady', () => {
	if (!isEnabled()) return;
	for (const token of canvas.tokens?.placeables ?? []) token.initializeVisionSource?.();
});
