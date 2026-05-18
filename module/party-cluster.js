const OUTPUT_SIZE = 512;
const OUTPUT_FOLDER = 'party-token-clusters';
const IMAGE_EXTENSIONS = new Set(['apng', 'avif', 'bmp', 'gif', 'jpg', 'jpeg', 'png', 'svg', 'webp']);
const SIZE_SCALE = {
	tiny: 0.84,
	sm: 0.92,
	small: 0.92,
	med: 1,
	medium: 1,
	lg: 1.1,
	large: 1.1,
	huge: 1.18,
	grg: 1.25,
	gargantuan: 1.25,
};

function isPartyTokenApplication(app) {
	const actor = app?.token?.actor;
	return game.user.isGM && actor?.type === 'party';
}

function addPartyClusterButton(app, buttons) {
	if (!isPartyTokenApplication(app)) return;

	buttons.unshift({
		label: 'Cluster Party',
		class: 'cluster-party-token',
		icon: 'fas fa-users',
		onClick: () => createPartyTokenCluster(app.token),
	});
}

async function createPartyTokenCluster(partyToken) {
	try {
		const party = partyToken.actor;
		const members = await getPartyMembers(party);
		if (!members.length) {
			ui.notifications.warn(`${party.name} has no party members to cluster.`);
			return;
		}

		const portraits = collectTokenPortraits(members);
		if (!portraits.length) {
			ui.notifications.warn('No usable member token images were found.');
			return;
		}

		ui.notifications.info(`Building ${party.name} party token...`);
		const blob = await renderClusterImage(portraits);
		const path = await uploadClusterImage(party, blob);
		await party.update({
			img: path,
			'prototypeToken.texture.src': path,
		});
		await updatePlacedPartyTokens(party, partyToken, path);
		ui.notifications.info(`${party.name} party token updated.`);
	} catch (error) {
		console.error('PF2 Director | Error creating party token cluster:', error);
		ui.notifications.error('Unable to create the party token cluster. See the console for details.');
	}
}

async function updatePlacedPartyTokens(party, partyToken, path) {
	const tokenDocuments = new Map();

	if (partyToken?.parent?.documentName === 'Scene') {
		tokenDocuments.set(partyToken.id, partyToken);
	}

	if (canvas?.ready) {
		for (const token of canvas.tokens.controlled) {
			if (token.actor?.id === party.id) tokenDocuments.set(token.document.id, token.document);
		}

		for (const token of canvas.tokens.placeables) {
			if (token.actor?.id === party.id) tokenDocuments.set(token.document.id, token.document);
		}
	}

	if (!tokenDocuments.size && partyToken?.update) {
		await partyToken.update({ 'texture.src': path });
		return;
	}

	await Promise.all(
		Array.from(tokenDocuments.values()).map((tokenDocument) => tokenDocument.update({ 'texture.src': path }))
	);
}

async function getPartyMembers(party) {
	const members = normalizeActorList(party.members);
	if (members.length) return members;

	const memberRefs = [
		party.system?.details?.members,
		party.system?.members,
		party.flags?.pf2e?.members,
	].flatMap((refs) => (Array.isArray(refs) ? refs : []));
	const resolved = [];

	for (const ref of memberRefs) {
		const actor = await resolveActorReference(ref);
		if (actor && actor.id !== party.id && !resolved.some((member) => member.id === actor.id)) {
			resolved.push(actor);
		}
	}
	if (resolved.length) return resolved;

	const worldParty = game.actors.party ?? game.actors.find?.((actor) => actor.type === 'party');
	if (worldParty?.id === party.id) {
		return game.actors.contents.filter((actor) => actor.type === 'character' && actor.hasPlayerOwner);
	}

	return [];
}

function normalizeActorList(value) {
	const actors = value?.contents ?? value;
	if (!Array.isArray(actors)) return [];
	return actors.filter((actor) => actor instanceof Actor && actor.type !== 'party');
}

async function resolveActorReference(ref) {
	if (ref instanceof Actor) return ref;
	if (typeof ref === 'string') {
		return ref.includes('.') ? (await safeFromUuid(ref)) ?? null : game.actors.get(ref) ?? null;
	}
	if (typeof ref?.uuid === 'string') return safeFromUuid(ref.uuid);
	if (typeof ref?.id === 'string') return game.actors.get(ref.id) ?? null;
	if (typeof ref?.actor === 'string') return game.actors.get(ref.actor) ?? null;
	return null;
}

async function safeFromUuid(uuid) {
	try {
		return (await fromUuid(uuid)) ?? null;
	} catch (_error) {
		return null;
	}
}

function collectTokenPortraits(members) {
	const activeTokens = canvas?.ready
		? canvas.tokens.placeables.filter((token) => members.some((member) => token.actor?.id === member.id))
		: [];

	return members
		.map((member) => {
			const activeToken = activeTokens.find((token) => token.actor?.id === member.id);
			const src = firstImagePath(
				activeToken?.document?.texture?.src,
				member.prototypeToken?.texture?.src,
				member.img
			);
			return src
				? {
						name: member.name,
						src,
						sizeScale: getMemberSizeScale(member, activeToken?.document),
				  }
				: null;
		})
		.filter(Boolean);
}

function getMemberSizeScale(actor, tokenDocument) {
	const size = actor.system?.traits?.size?.value ?? actor.system?.traits?.size;
	const actorScale = typeof size === 'string' ? SIZE_SCALE[size.toLowerCase()] : null;
	if (actorScale) return actorScale;

	const tokenWidth = Number(tokenDocument?.width ?? actor.prototypeToken?.width);
	const tokenHeight = Number(tokenDocument?.height ?? actor.prototypeToken?.height);
	const tokenScale = Math.sqrt(Math.max(tokenWidth || 1, tokenHeight || 1));
	return clamp(1 + (tokenScale - 1) * 0.12, 0.84, 1.25);
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function firstImagePath(...paths) {
	return paths.find((path) => typeof path === 'string' && path && isImagePath(path));
}

function isImagePath(path) {
	const cleanPath = path.split('?')[0].split('#')[0];
	const extension = cleanPath.split('.').pop()?.toLowerCase();
	return extension && IMAGE_EXTENSIONS.has(extension);
}

async function renderClusterImage(portraits) {
	const canvasEl = document.createElement('canvas');
	canvasEl.width = OUTPUT_SIZE;
	canvasEl.height = OUTPUT_SIZE;
	const context = canvasEl.getContext('2d');
	const layout = getClusterLayout(portraits.length);

	const loaded = (
		await Promise.allSettled(
			portraits.map(async (portrait, index) => ({
				...portrait,
				image: await loadImage(portrait.src),
				...layout[index],
			}))
		)
	)
		.filter((result) => result.status === 'fulfilled')
		.map((result) => result.value);

	if (!loaded.length) throw new Error('No member token images could be loaded.');

	loaded
		.sort((a, b) => a.y - b.y)
		.forEach((portrait) => drawPortrait(context, portrait));

	const outputCanvas = trimTransparentPadding(canvasEl);
	return new Promise((resolve, reject) => {
		outputCanvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error('Canvas export failed.'));
		}, 'image/webp', 0.92);
	});
}

function trimTransparentPadding(sourceCanvas) {
	const context = sourceCanvas.getContext('2d');
	const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
	const bounds = getVisibleBounds(imageData);
	if (!bounds) return sourceCanvas;

	const padding = 18;
	const visibleWidth = bounds.right - bounds.left + 1;
	const visibleHeight = bounds.bottom - bounds.top + 1;
	const cropSize = Math.min(
		Math.max(visibleWidth, visibleHeight) + padding * 2,
		Math.min(sourceCanvas.width, sourceCanvas.height)
	);
	const centerX = (bounds.left + bounds.right) / 2;
	const centerY = (bounds.top + bounds.bottom) / 2;
	const cropX = clamp(centerX - cropSize / 2, 0, sourceCanvas.width - cropSize);
	const cropY = clamp(centerY - cropSize / 2, 0, sourceCanvas.height - cropSize);

	const outputCanvas = document.createElement('canvas');
	outputCanvas.width = OUTPUT_SIZE;
	outputCanvas.height = OUTPUT_SIZE;
	outputCanvas
		.getContext('2d')
		.drawImage(sourceCanvas, cropX, cropY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
	return outputCanvas;
}

function getVisibleBounds(imageData) {
	const { data, width, height } = imageData;
	const bounds = { left: width, top: height, right: -1, bottom: -1 };

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const alpha = data[(y * width + x) * 4 + 3];
			if (alpha <= 8) continue;

			bounds.left = Math.min(bounds.left, x);
			bounds.top = Math.min(bounds.top, y);
			bounds.right = Math.max(bounds.right, x);
			bounds.bottom = Math.max(bounds.bottom, y);
		}
	}

	return bounds.right >= bounds.left && bounds.bottom >= bounds.top ? bounds : null;
}

function getClusterLayout(count) {
	const base = [
		{ x: 0, y: 0, size: 196 },
		{ x: -88, y: 54, size: 174 },
		{ x: 90, y: 48, size: 174 },
		{ x: -42, y: -92, size: 158 },
		{ x: 52, y: -84, size: 158 },
		{ x: -128, y: -32, size: 142 },
		{ x: 130, y: -24, size: 142 },
		{ x: -12, y: 126, size: 150 },
	];

	return Array.from({ length: count }, (_value, index) => {
		const slot = base[index] ?? spiralSlot(index);
		return {
			x: OUTPUT_SIZE / 2 + slot.x,
			y: OUTPUT_SIZE / 2 + slot.y,
			size: slot.size,
		};
	});
}

function spiralSlot(index) {
	const angle = index * 2.399963229728653;
	const radius = 78 + Math.sqrt(index) * 48;
	return {
		x: Math.cos(angle) * radius,
		y: Math.sin(angle) * radius,
		size: Math.max(96, 144 - index * 4),
	};
}

function drawPortrait(context, portrait) {
	const size = portrait.size * portrait.sizeScale;
	const x = portrait.x - size / 2;
	const y = portrait.y - size / 2;
	const { width, height } = portrait.image;
	const scale = Math.min(size / width, size / height);
	const drawWidth = width * scale;
	const drawHeight = height * scale;

	context.save();
	context.shadowColor = 'rgba(0, 0, 0, 0.45)';
	context.shadowBlur = 16;
	context.shadowOffsetY = 10;
	context.drawImage(
		portrait.image,
		x + (size - drawWidth) / 2,
		y + (size - drawHeight) / 2,
		drawWidth,
		drawHeight
	);
	context.restore();
}

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
		image.src = src;
	});
}

async function uploadClusterImage(party, blob) {
	const folder = `worlds/${game.world.id}/${OUTPUT_FOLDER}`;
	await ensureDirectory(folder);

	const safeName = slugify(party.name) || `party-${party.id}`;
	const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
	const file = new File([blob], `${safeName}-${stamp}.webp`, { type: 'image/webp' });
	const response = await getFilePicker().upload('data', folder, file, {}, { notify: false });
	return response.path;
}

function slugify(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

async function ensureDirectory(folder) {
	try {
		await getFilePicker().createDirectory('data', folder, {}, { notify: false });
	} catch (error) {
		if (!String(error.message ?? error).toLowerCase().includes('exists')) throw error;
	}
}

function getFilePicker() {
	return foundry.applications.apps.FilePicker.implementation;
}

Hooks.on('getHeaderControlsTokenApplication', addPartyClusterButton);
