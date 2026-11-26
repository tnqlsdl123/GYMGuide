import { catalogLink, element, loadData, showImage } from './site.js';

const params = new URLSearchParams(location.search);
const message = document.querySelector('#detail-message');
const detail = document.querySelector('#equipment-detail');
document.querySelector('.back-link').href = catalogLink(params.get('q'), params.get('category'));

function addVideos(videos) {
    const section = document.querySelector('#videos');
    const links = section.querySelector('.video-links');
    for (const { url, title } of videos) {
        let destination;
        try {
            destination = new URL(url);
        } catch {
            continue;
        }
        if (destination.protocol !== 'https:' || destination.username || destination.password) continue;
        const link = element('a', 'video-link', title);
        link.href = destination.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.append(element('span', 'sr-only', ' (새 탭)'));
        links.append(link);
    }
    section.hidden = !links.childElementCount;
}

async function renderDetail() {
    const { categories, equipment } = await loadData('equipment.json');
    const item = equipment.find(item => item.slug === params.get('id'));
    if (!item) {
        message.textContent = '선택한 운동기구를 찾을 수 없어요. 운동기구 목록에서 다시 선택해 주세요.';
        return;
    }

    document.title = item.name + ' | GYM GUIDE';
    showImage(detail.querySelector('.detail-media'), item.image, item.name);
    detail.querySelector('.category-tag').textContent = categories.find(category => category.slug === item.category)?.name ?? '';
    detail.querySelector('h1').textContent = item.name;
    detail.querySelector('.english-name').textContent = item.englishName;
    detail.querySelector('#summary').textContent = item.summary;
    detail.querySelector('#muscles').textContent = item.muscles;
    detail.querySelector('#difficulty').textContent = item.difficulty || '미분류';

    const benefits = detail.querySelector('.benefits');
    benefits.querySelector('ul').append(...item.benefits.map(text => element('li', '', text)));
    if (item.muscleImage) {
        benefits.classList.add('has-muscle-image');
        showImage(benefits, item.muscleImage, item.name + '의 주요 자극 부위: ' + item.muscles);
    }

    detail.querySelector('.steps').append(...item.steps.map((text, index) => {
        const step = element('li');
        const number = element('span', 'step-number', index + 1);
        number.setAttribute('aria-hidden', 'true');
        step.append(number, element('span', '', text));
        return step;
    }));

    const cautions = [...(item.cautions ?? []), '운동 중 통증이 생기면 동작을 멈추세요.'];
    detail.querySelector('.cautions ul').append(...cautions.map(text => element('li', '', text)));
    addVideos(item.videos ?? []);
    detail.hidden = false;
    message.hidden = true;
}

renderDetail().catch(error => {
    message.textContent = '운동기구 정보를 불러오지 못했어요. 페이지를 새로고침해 주세요.';
    console.error(error);
});
