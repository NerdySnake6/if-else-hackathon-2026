export function hasCoords(opportunity) {
    return Number.isFinite(opportunity.lat) && Number.isFinite(opportunity.lng);
}

export function createMapController({
    apiKey,
    state,
    isFavoriteOpportunity,
    isFavoriteCompany,
    createEl,
    opportunityTypeLabel,
    workFormatLabel,
    onSelectOpportunity,
}) {
    let map;
    let ymapsReadyPromise;
    let placemarks = [];

    function buildOpportunityPopup(opportunity) {
        const popup = createEl('div', 'opportunity-popup');
        popup.appendChild(createEl('h6', '', opportunity.title));
        popup.appendChild(createEl('div', 'company', opportunity.employer_name || 'Работодатель'));
        popup.appendChild(createEl('div', 'small text-muted', opportunityTypeLabel(opportunity.type)));

        if (opportunity.salary_range) {
            popup.appendChild(createEl('div', 'salary', `💰 ${opportunity.salary_range}`));
        }

        const tags = Array.isArray(opportunity.tags) ? opportunity.tags.map((tag) => `#${tag.name}`).join(' ') : '';
        if (tags) {
            popup.appendChild(createEl('div', 'tags', tags));
        }
        popup.appendChild(createEl('small', '', `${opportunity.location} | ${workFormatLabel(opportunity.work_format)}`));
        return popup;
    }

    function loadYandexMaps() {
        if (!apiKey) {
            return Promise.reject(new Error('Не указан API-ключ Яндекс Карт'));
        }
        if (window.ymaps) {
            return Promise.resolve(window.ymaps);
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
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
            controls: ['zoomControl'],
        });
        map.behaviors.disable('scrollZoom');
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            map.behaviors.disable('drag');
        }
    }

    function renderMap(opportunities) {
        if (!map || !window.ymaps) return;
        const ymaps = window.ymaps;

        placemarks.forEach((placemark) => map.geoObjects.remove(placemark));
        placemarks = [];

        opportunities.forEach((opportunity) => {
            if (!hasCoords(opportunity)) return;

            const popup = buildOpportunityPopup(opportunity);
            const placemark = new ymaps.Placemark(
                [opportunity.lat, opportunity.lng],
                {
                    balloonContentHeader: opportunity.title,
                    balloonContentBody: popup.outerHTML,
                },
                {
                    preset: state.selectedOpportunityId === opportunity.id
                        ? 'islands#darkBlueCircleDotIcon'
                        : isFavoriteOpportunity(opportunity.id)
                            ? 'islands#redCircleDotIcon'
                            : isFavoriteCompany(opportunity.employer_id)
                                ? 'islands#orangeCircleDotIcon'
                                : 'islands#blueCircleDotIcon',
                }
            );

            placemark.events.add('click', () => {
                onSelectOpportunity(opportunity.id);
            });

            map.geoObjects.add(placemark);
            placemarks.push(placemark);
        });
    }

    function centerOnOpportunity(opportunity) {
        if (map && hasCoords(opportunity)) {
            map.setCenter([opportunity.lat, opportunity.lng], 14, { duration: 250 });
        }
    }

    return {
        initMap,
        renderMap,
        centerOnOpportunity,
    };
}
