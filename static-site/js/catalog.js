import { catalogLink, element, loadData, showImage } from './site.js';
import { watchSchedule } from './gym.js';

const form = document.querySelector('.search-form');
const input = document.querySelector('#keyword');
const categoryInput = form.elements.category;
const clear = document.querySelector('.clear-search');
const filters = document.querySelector('.filters');
const result = document.querySelector('.result-count');
const grid = document.querySelector('.catalog-grid');
const empty = document.querySelector('.empty');
const cardTemplate = document.querySelector('#equipment-card');

const params = new URLSearchParams(location.search);
const keyword = (params.get('q') ?? '').trim();
const requestedCategory = params.get('category') ?? '';
input.value = keyword;
categoryInput.value = requestedCategory;
categoryInput.disabled = !requestedCategory;

function updateClear() {
    clear.hidden = !input.value;
}

input.addEventListener('input', updateClear);
clear.addEventListener('click', () => {
    input.value = '';
    updateClear();
    form.requestSubmit();
});
updateClear();

function normalize(value) {
    return value.normalize('NFC').toLowerCase().replace(/\s+/g, '');
}

function createCard(item, categoryName, category) {
    const card = cardTemplate.content.cloneNode(true);
    const detailParams = new URLSearchParams({ id: item.slug });
    if (keyword) detailParams.set('q', keyword);
    if (category) detailParams.set('category', category);
    card.querySelector('a').href = './equipment.html?' + detailParams;
    showImage(card.querySelector('.card-media'), item.image, '');
    card.querySelector('.category-tag').textContent = categoryName;
    card.querySelector('h3').textContent = item.name;
    card.querySelector('.card-muscles').textContent = item.muscles;
    card.querySelector('.card-summary').textContent = item.summary;
    return card;
}

async function renderCatalog() {
    const { categories, equipment } = await loadData('equipment.json');
    const names = new Map(categories.map(({ slug, name }) => [slug, name]));
    const category = names.has(requestedCategory) ? requestedCategory : '';
    categoryInput.value = category;
    categoryInput.disabled = !category;

    for (const [slug, name] of [['', '전체'], ...names]) {
        const link = element('a', 'filter', name);
        link.href = catalogLink(keyword, slug);
        if (slug === category) link.setAttribute('aria-current', 'true');
        filters.append(link);
    }
    filters.hidden = false;

    const query = normalize(keyword);
    const matches = equipment.filter(item =>
        (!category || item.category === category || item.secondaryCategories?.includes(category)) &&
        [item.name, item.englishName, item.muscles, ...(item.aliases ?? [])]
            .some(value => normalize(value).includes(query))
    );
    grid.append(...matches.map(item => createCard(item, names.get(item.category), category)));
    result.textContent = '운동기구 ' + matches.length + '개';
    grid.hidden = matches.length === 0;
    empty.hidden = matches.length > 0;
}

renderCatalog().catch(error => {
    result.textContent = '운동기구 목록을 불러오지 못했어요. 페이지를 새로고침해 주세요.';
    console.error(error);
});
watchSchedule();
