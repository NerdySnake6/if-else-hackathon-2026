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
        // Краткое описание (обрезаем до 100 символов)
        const shortDesc = opp.description.length > 100 
            ? opp.description.substring(0, 100) + '…' 
            : opp.description;
        
        item.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1">${opp.title}</h6>
                <small class="badge bg-secondary">${opp.type}</small>
            </div>
            <p class="mb-1">${shortDesc}</p>
            <small>
                <i class="bi bi-geo-alt"></i> ${opp.location} | ${opp.work_format}
                ${opp.salary_range ? ` | 💰 ${opp.salary_range}` : ''}
            </small>
        `;

        // При клике на элемент списка перемещаем карту к маркеру (если есть координаты)
        item.addEventListener('click', (e) => {
            e.preventDefault();
            if (opp.lat && opp.lng) {
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
        if (opp.lat && opp.lng) {
            const marker = L.marker([opp.lat, opp.lng]).addTo(map);
            
            // Формируем контент для попапа
            const tags = opp.tags.map(t => `#${t.name}`).join(' ');
            const companyName = opp.employer?.company_name || 'Компания';

            const popupContent = `
                <div class="opportunity-popup">
                    <h6>${opp.title}</h6>
                    <div class="company">${companyName}</div>
                    ${opp.salary_range ? `<div class="salary">💰 ${opp.salary_range}</div>` : ''}
                    <div class="tags">${tags}</div>
                    <small>${opp.location} | ${opp.work_format}</small>
                </div>
            `;

            marker.bindPopup(popupContent);
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
