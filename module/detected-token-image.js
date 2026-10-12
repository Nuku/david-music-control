import { MODULE_ID } from './settings.js';

const textureCache = new Map();
const tokenTextureStates = new WeakMap();

function loadTexture(src) {
	if (!textureCache.has(src)) {
		textureCache.set(src, globalThis.loadTexture(src).catch((error) => {
			textureCache.delete(src);
			console.warn(`PF2 Director | Could not load detected token image: ${src}`, error);
			return null;
		}));
	}
	return textureCache.get(src);
}

function refreshTokenTexture(token) {
	const mesh = token.mesh;
	if (!mesh) return;

	let state = tokenTextureStates.get(token);
	if (!state || state.mesh !== mesh) {
		state = { mesh, originalTexture: mesh.texture, appliedTexture: null, requestedSrc: null };
		tokenTextureStates.set(token, state);
	} else if (state.appliedTexture && mesh.texture !== state.appliedTexture) {
		// Foundry refreshed the token's own art while our replacement was active.
		state.originalTexture = mesh.texture;
		state.appliedTexture = null;
		state.requestedSrc = null;
	}

	const hasObscuringDetection = token.detectionFilter?.constructor?.name === 'OutlineOverlayFilter';
	const replacement = game.settings.get(MODULE_ID, 'useDetectedTokenImage') && hasObscuringDetection
		? game.settings.get(MODULE_ID, 'detectedTokenImage')?.trim()
		: '';

	if (!replacement) {
		// Invalidate any pending load and restore the per-token texture when this
		// viewer can see the token normally again.
		state.requestedSrc = null;
		if (state.appliedTexture && mesh.texture === state.appliedTexture) mesh.texture = state.originalTexture;
		state.appliedTexture = null;
		return;
	}

	if (state.requestedSrc === replacement) return;
	state.requestedSrc = replacement;
	loadTexture(replacement).then((texture) => {
		if (!texture || tokenTextureStates.get(token) !== state || state.mesh !== token.mesh || state.requestedSrc !== replacement) return;

		const stillRequested = game.settings.get(MODULE_ID, 'useDetectedTokenImage')
			&& token.detectionFilter?.constructor?.name === 'OutlineOverlayFilter'
			&& game.settings.get(MODULE_ID, 'detectedTokenImage')?.trim() === replacement;
		if (!stillRequested) return;

		if (mesh.texture !== state.appliedTexture) state.originalTexture = mesh.texture;
		mesh.texture = texture;
		state.appliedTexture = texture;
	});
}

Hooks.once('setup', () => {
	const TokenClass = CONFIG.Token.objectClass;
	if (!TokenClass?.prototype?.render) return;

	const originalRender = TokenClass.prototype.render;
	TokenClass.prototype.render = function (renderer, ...args) {
		const result = originalRender.call(this, renderer, ...args);
		refreshTokenTexture(this);
		return result;
	};
});
