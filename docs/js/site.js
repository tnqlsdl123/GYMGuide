export function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export async function loadData(filename) {
    const response = await fetch(new URL('../data/' + filename, import.meta.url));
    if (!response.ok) throw new Error('Could not load ' + filename + ' (' + response.status + ')');
    return response.json();
}

export function catalogLink(q, category) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    return './guide.html' + (params.size ? '?' + params : '');
}

export function setupRetry() {
    for (const button of document.querySelectorAll('[data-retry]')) {
        button.addEventListener('click', () => location.reload());
    }
}

export function equipmentCard(item, categoryName, keyword, category) {
    const card = document.querySelector('#equipment-card').content.cloneNode(true);
    const params = new URLSearchParams({ id: item.slug });
    if (keyword) params.set('q', keyword);
    if (category) params.set('category', category);
    card.querySelector('a').href = './equipment.html?' + params;
    showImage(card.querySelector('.card-media'), item.image, '');
    card.querySelector('.category-tag').textContent = categoryName;
    card.querySelector('h3').textContent = item.name;
    card.querySelector('.card-muscles').textContent = item.muscles;
    card.querySelector('.card-benefit').textContent = item.benefits?.[0] || item.summary;
    return card;
}

export function showImage(container, path, alt) {
    if (!path) return;
    const image = container.querySelector('img');
    const placeholder = container.querySelector('span');
    image.addEventListener('error', () => {
        image.hidden = true;
        if (placeholder) placeholder.hidden = false;
        container.classList.remove('has-muscle-image');
    }, { once: true });
    image.alt = alt;
    image.src = './' + path;
    image.hidden = false;
    if (placeholder) placeholder.hidden = true;
}
