import { equipmentCard, loadData, setupRetry, catalogLink } from './site.js';
import { watchSchedule } from './gym.js';

const params = new URLSearchParams(location.search);
if (params.has('q') || params.has('category') || location.hash === '#equipment') {
    location.replace(catalogLink(params.get('q'), params.get('category')));
} else {
    setupRetry();
    watchSchedule();
    renderFeatured().catch(error => {
        const status = document.querySelector('#featured-status');
        status.textContent = '대표 운동기구를 불러오지 못했어요.';
        status.parentElement.querySelector('[data-retry]').hidden = false;
        console.error(error);
    });
}

async function renderFeatured() {
    const { categories, equipment } = await loadData('equipment.json');
    const names = new Map(categories.map(({ slug, name }) => [slug, name]));
    const selected = ['chest-press', 'lat-pulldown', 'leg-press'];
    const featured = selected.map(slug => equipment.find(item => item.slug === slug)).filter(Boolean);
    for (const item of equipment) {
        if (featured.length >= selected.length) break;
        if (!featured.includes(item)) featured.push(item);
    }

    const status = document.querySelector('#featured-status');
    if (!featured.length) {
        status.textContent = '표시할 운동기구가 없어요.';
        return;
    }
    const grid = document.querySelector('#featured-grid');
    grid.append(...featured.map(item => equipmentCard(item, names.get(item.category))));
    grid.hidden = false;
    status.hidden = true;
}
