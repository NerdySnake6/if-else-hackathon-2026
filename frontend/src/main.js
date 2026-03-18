import './style.css';

// Базовый URL API (через прокси Vite)
const API_BASE = '/api';
const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY;

// Глобальный массив всех возможностей (понадобится для фильтрации)
let allOpportunities = [];
let map;
let ymapsReadyPromise;
let placemarks = [];

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) {
        el.className = className;
    }
    if (text !== undefined) {
        el.textContent = text;
    }
    return el;
}

function hasCoords(opp) {
    return Number.isFinite(opp.lat) && Number.isFinite(opp.lng);
}

function buildOpportunityPopup(opp) {
    const popup = createEl('div', 'opportunity-popup');
    popup.appendChild(createEl('h6', '', opp.title));
    popup.appendChild(createEl('div', 'company', 'Компания'));

    if (opp.salary_range) {
        popup.appendChild(createEl('div', 'salary', `💰 ${opp.salary_range}`));
    }

    const tags = Array.isArray(opp.tags) ? opp.tags.map((t) => `#${t.name}`).join(' ') : '';
    popup.appendChild(createEl('div', 'tags', tags));
    popup.appendChild(createEl('small', '', `${opp.location} | ${opp.work_format}`));
    return popup;
}

function loadYandexMaps() {
    if (!YANDEX_API_KEY) {
        return Promise.reject(new Error('Не указан API-ключ Яндекс Карт'));
    }
    if (window.ymaps) {
        return Promise.resolve(window.ymaps);
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_API_KEY}&lang=ru_RU`;
        script.async = true;
        script.onerror = () => reject(new Error('Не удалось загрузить Яндекс Карты'));
        script.onload = () => {
            window.ymaps.ready(() => resolve(window.ymaps));
        };
        document.head.appendChild(script);
    });
}

async function initMap() {
    if (!ymapsReadyPromise) {
        ymapsReadyPromise = loadYandexMaps();
    }
    const ymaps = await ymapsReadyPromise;
    map = new ymaps.Map('map', {
        center: [55.7558, 37.6176],
        zoom: 10,
        controls: ['zoomControl']
    });
}

// Загрузка данных с бэкенда
async function loadOpportunities() {
    try {
        const response = await fetch(`${API_BASE}/opportunities/`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();
        allOpportunities = data;
        renderList(allOpportunities);
        renderMap(allOpportunities);
    } catch (error) {
        console.error('Не удалось загрузить возможности:', error);
        document.getElementById('opportunities-list').innerHTML = 
            '<div class="alert alert-danger">Не удалось загрузить данные</div>';
    }
}

// Отображение списка
function renderList(opportunities) {
    const listEl = document.getElementById('opportunities-list');
    listEl.innerHTML = '';

    if (opportunities.length === 0) {
        listEl.innerHTML = '<div class="list-group-item">Нет доступных возможностей</div>';
        return;
    }

    opportunities.forEach(opp => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action opportunity-item';
        const shortDesc = opp.description.length > 100
            ? opp.description.substring(0, 100) + '…'
            : opp.description;

        const header = createEl('div', 'd-flex w-100 justify-content-between');
        header.appendChild(createEl('h6', 'mb-1', opp.title));
        header.appendChild(createEl('small', 'badge bg-secondary', opp.type));

        const desc = createEl('p', 'mb-1', shortDesc);

        const meta = createEl('small');
        const icon = createEl('i', 'bi bi-geo-alt');
        meta.appendChild(icon);
        meta.append(` ${opp.location} | ${opp.work_format}`);
        if (opp.salary_range) {
            meta.append(` | 💰 ${opp.salary_range}`);
        }

        item.appendChild(header);
        item.appendChild(desc);
        item.appendChild(meta);

        // При клике на элемент списка перемещаем карту к маркеру (если есть координаты)
        item.addEventListener('click', (e) => {
            e.preventDefault();
            if (hasCoords(opp)) {
                map.setCenter([opp.lat, opp.lng], 14, { duration: 300 });
            } else {
                alert('Для этой возможности не указаны координаты');
            }
        });

        listEl.appendChild(item);
    });
}

// Отображение маркеров на карте
function renderMap(opportunities) {
    if (!map || !window.ymaps) return;
    const ymaps = window.ymaps;

    placemarks.forEach((placemark) => map.geoObjects.remove(placemark));
    placemarks = [];

    opportunities.forEach(opp => {
        if (hasCoords(opp)) {
            const popup = buildOpportunityPopup(opp);
            const placemark = new ymaps.Placemark(
                [opp.lat, opp.lng],
                {
                    balloonContentHeader: opp.title,
                    balloonContentBody: popup.outerHTML
                },
                {
                    preset: 'islands#blueCircleDotIcon'
                }
            );
            map.geoObjects.add(placemark);
            placemarks.push(placemark);
        }
    });
}

// Функции для фильтрации (пока заглушки, добавим позже)
// ...

// Запуск при загрузке страницы
(async function bootstrap() {
    try {
        await initMap();
        await loadOpportunities();
    } catch (error) {
        console.error('Ошибка инициализации карты:', error);
        const mapEl = document.getElementById('map');
        mapEl.innerHTML = '<div class="alert alert-danger m-2">Не удалось загрузить карту</div>';
    }
})();

// Обработчики для кнопок входа/регистрации (пока просто заглушки)
document.getElementById('loginBtn').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Форма входа будет позже');
});

document.getElementById('registerBtn').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Форма регистрации будет позже');
});
