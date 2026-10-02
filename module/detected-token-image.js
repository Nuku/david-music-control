import { MODULE_ID } from './settings.js';

const textureCache = new Map();
const tokenTextureRequests = new WeakMap();

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
	const enabled = game.settings.get(MODULE_ID, 'useDetectedTokenImage');
	const replacement = enabled && token.detectionFilter ? game.settings.get(MODULE_ID, 'detectedTokenImage')?.trim() : '';
	if (!replacement || !token.mesh) return;

	tokenTextureRequests.set(token, replacement);
	loadTexture(replacement).then((texture) => {
		if (!texture || tokenTextureRequests.get(token) !== replacement || !token.mesh) return;

		const stillRequested = game.settings.get(MODULE_ID, 'useDetectedTokenImage')
			&& token.detectionFilter
			&& game.settings.get(MODULE_ID, 'detectedTokenImage')?.trim() === replacement;
		if (stillRequested && token.mesh.texture !== texture) token.mesh.texture = texture;
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
