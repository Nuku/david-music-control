import { MODULE_ID, getSetting } from './settings.js';

// The original Token vision source is reused for the first corner. Three
// additional sources complete the four-corner view without retaining a
// center-anchored source.
const CORNER_SOURCE_COUNT = 3;
const CORNER_INSET_PIXELS = 1;
const CORNER_SOURCE_KEY = Symbol('pf2DirectorEnhancedVisionSources');

function isEnabled() {
	try {
		return Boolean(getSetting('enhancedVision'));
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
	const points = getCornerPoints(token);
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

Hooks.on('canvasReady', () => {
	if (!isEnabled()) return;
	for (const token of canvas.tokens?.placeables ?? []) token.initializeVisionSource?.();
});
