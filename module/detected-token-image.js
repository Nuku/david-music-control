import { MODULE_ID } from './settings.js';

const textureCache = new Map();

function getTexture(src) {
	if (!textureCache.has(src)) textureCache.set(src, PIXI.Texture.from(src));
	return textureCache.get(src);
}

function refreshTokenTexture(token) {
	const mesh = token.mesh;
	if (!mesh) return;

	const enabled = game.settings.get(MODULE_ID, 'useDetectedTokenImage');
	const replacement = enabled && token.detectionFilter ? game.settings.get(MODULE_ID, 'detectedTokenImage')?.trim() : '';
	const src = replacement || token.document.texture.src;
	if (src && mesh.texture !== getTexture(src)) mesh.texture = getTexture(src);
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
