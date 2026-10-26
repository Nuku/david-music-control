function requirementsText(description) {
	if (typeof description !== 'string' || !description) return '';
	const section = description.match(/<(?:strong|b|h[1-6])\b[^>]*>\s*Requirements\s*:?[\s\S]*?<\/(?:strong|b|h[1-6])\s*>([\s\S]*?)(?=<hr\b|<(?:strong|b|h[1-6])\b|$)/i);
	if (!section) return '';
	const element = document.createElement('div');
	element.innerHTML = section[1];
	return (element.textContent ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase(game.i18n.lang);
}

function patchTab(tab, browser) {
	if (tab.__requirementsFilterPatched) return;
	tab.__requirementsFilterPatched = true;
	const prototype = Object.getPrototypeOf(tab);
	let resultsDescriptor;
	for (let current = prototype; current && !resultsDescriptor; current = Object.getPrototypeOf(current)) {
		resultsDescriptor = Object.getOwnPropertyDescriptor(current, 'results');
	}
	if (resultsDescriptor?.get && resultsDescriptor?.set) {
		Object.defineProperty(tab, 'results', {
			configurable: true,
			get() {
				const results = resultsDescriptor.get.call(this);
				if (this.tabName !== 'feat' && this.tabName !== 'campaignFeature') return results;
				const query = this.filterData.requirementsQuery?.trim().toLocaleLowerCase(game.i18n.lang);
				return query ? results.filter((entry) => browser.__requirementsByUuid.get(entry.uuid)?.includes(query)) : results;
			},
			set(value) {
				resultsDescriptor.set.call(this, value);
			}
		});
	}

	const filterData = foundry.utils.deepClone(tab.filterData);
	filterData.requirementsQuery = browser.__requirementsQuery ?? '';
	tab.filterData = filterData;
}

function addRequirementsInput(app, element) {
	const root = element instanceof HTMLElement ? element : element?.[0];
	if (!(root instanceof HTMLElement)) return;
	const existing = root.querySelector('.pf2d-requirements-filter');
	if (app.activeTab?.tabName !== 'feat' && app.activeTab?.tabName !== 'campaignFeature') {
		existing?.remove();
		return;
	}
	const query = app.__requirementsQuery ?? '';
	if (app.activeTab.filterData.requirementsQuery !== query) {
		const filterData = foundry.utils.deepClone(app.activeTab.filterData);
		filterData.requirementsQuery = query;
		app.activeTab.filterData = filterData;
	}
	if (existing) {
		existing.querySelector('input').value = query;
		return;
	}
	const traitField = [...root.querySelectorAll('.traits-select')].find((node) => node.closest('fieldset'));
	const traitSet = traitField?.closest('fieldset');
	if (!traitSet) return;

	const field = document.createElement('div');
	field.className = 'form-group pf2d-requirements-filter';
	field.innerHTML = '<label for="pf2d-requirements-query">Requirements</label><input id="pf2d-requirements-query" type="text" autocomplete="off" placeholder="Search requirements">';
	traitSet.after(field);
	const input = field.querySelector('input');
	input.value = query;
	input.addEventListener('input', () => {
		app.__requirementsQuery = input.value;
		const filterData = foundry.utils.deepClone(app.activeTab.filterData);
		filterData.requirementsQuery = app.__requirementsQuery;
		app.activeTab.filterData = filterData;
	});
}

Hooks.once('ready', () => {
	if (game.system.id !== 'pf2e') return;
	const browser = game.pf2e?.compendiumBrowser;
	if (!browser) return;
	browser.__requirementsQuery ??= '';
	browser.__requirementsByUuid = new Map();
	const loader = browser.packLoader;
	const originalLoadPacks = loader.loadPacks;
	loader.loadPacks = async function* (documentName, packs, fields, ...args) {
		if (Array.isArray(fields) && !fields.includes('system.description.value')) {
			fields = [...fields, 'system.description.value'];
		}
		for await (const result of originalLoadPacks.call(this, documentName, packs, fields, ...args)) {
			for (const entry of result.index ?? []) {
				browser.__requirementsByUuid.set(entry.uuid, requirementsText(entry.system?.description?.value));
			}
			yield result;
		}
	};
	for (const tab of browser.tabsArray ?? []) patchTab(tab, browser);
	Hooks.on('renderCompendiumBrowser', (app, element) => {
		if (app !== browser) return;
		for (const tab of browser.tabsArray ?? []) patchTab(tab, browser);
		addRequirementsInput(app, element);
		const root = element instanceof HTMLElement ? element : element?.[0];
		if (root && !root.__pf2dRequirementsObserver) {
			const observer = new MutationObserver(() => addRequirementsInput(app, root));
			observer.observe(root, { childList: true, subtree: true });
			root.__pf2dRequirementsObserver = observer;
		}
	});
});
