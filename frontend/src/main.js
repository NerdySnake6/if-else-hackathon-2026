import './style.css';
import L from 'leaflet';

// Базовый URL API (через прокси Vite)
const API_BASE = '/api';

// Инициализация карты с центром в Москве (можно изменить)
const map = L.map('map').setView([55.7558, 37.6176], 10);

// Добавляем тайлы OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Глобальный массив всех возможностей (понадобится для фильтрации)
let allOpportunities = [];

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
                map.setView([opp.lat, opp.lng], 14);
            } else {
                alert('Для этой возможности не указаны координаты');
            }
        });

        listEl.appendChild(item);
    });
}

// Отображение маркеров на карте
function renderMap(opportunities) {
    // Очищаем предыдущие маркеры (если нужна динамическая перерисовка, но проще удалить все и добавить заново)
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    opportunities.forEach(opp => {
        if (hasCoords(opp)) {
            const marker = L.marker([opp.lat, opp.lng]).addTo(map);
            marker.bindPopup(buildOpportunityPopup(opp));
        }
    });
}

// Функции для фильтрации (пока заглушки, добавим позже)
// ...

// Запуск при загрузке страницы
loadOpportunities();

// Обработчики для кнопок входа/регистрации (пока просто заглушки)
document.getElementById('loginBtn').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Форма входа будет позже');
});

document.getElementById('registerBtn').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Форма регистрации будет позже');
});
