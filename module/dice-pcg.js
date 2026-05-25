const PCG_MULTIPLIER = 6364136223846793005n;
const PCG_DEFAULT_INCREMENT = 1442695040888963407n;
const MASK_64 = (1n << 64n) - 1n;
const UINT32_RANGE = 0x1_0000_0000;
const METHOD_ID = 'pf2-director-pcg';

class PCG32 {
	constructor(seedState, seedIncrement = PCG_DEFAULT_INCREMENT) {
		this.state = 0n;
		this.increment = ((seedIncrement << 1n) | 1n) & MASK_64;
		this.nextUint32();
		this.state = (this.state + (seedState & MASK_64)) & MASK_64;
		this.nextUint32();
	}

	nextUint32() {
		const state = this.state;
		this.state = (state * PCG_MULTIPLIER + this.increment) & MASK_64;

		const xorshifted = Number((((state >> 18n) ^ state) >> 27n) & 0xffff_ffffn) >>> 0;
		const rotation = Number((state >> 59n) & 31n);
		return ((xorshifted >>> rotation) | (xorshifted << ((32 - rotation) & 31))) >>> 0;
	}
}

function random64BitBigInt() {
	const bytes = new Uint32Array(2);
	globalThis.crypto.getRandomValues(bytes);
	return (BigInt(bytes[0]) << 32n) | BigInt(bytes[1]);
}

function createSessionGenerator() {
	return new PCG32(random64BitBigInt(), random64BitBigInt());
}

const generator = createSessionGenerator();

function rollDieWithPCG(term) {
	const faces = Number(term?.faces);
	if (!Number.isInteger(faces) || faces < 1) return;

	const limit = Math.floor(UINT32_RANGE / faces) * faces;
	let value = generator.nextUint32();
	while (value >= limit) value = generator.nextUint32();
	return (value % faces) + 1;
}

Hooks.once('init', () => {
	const methods = CONFIG?.Dice?.fulfillment?.methods;
	if (!methods || methods[METHOD_ID]) return;

	methods[METHOD_ID] = {
		label: 'Digital Roll (PCG)',
		icon: 'fas fa-microchip',
		handler: rollDieWithPCG,
	};
});
