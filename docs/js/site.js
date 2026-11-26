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
    return './' + (params.size ? '?' + params : '') + '#equipment';
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
