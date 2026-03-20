import './style.css';

const API_BASE = '/api';
const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
const TOKEN_KEY = 'tramplin_access_token';
const FAVORITE_OPPORTUNITIES_KEY = 'tramplin_favorite_opportunities';
const FAVORITE_COMPANIES_KEY = 'tramplin_favorite_companies';

const state = {
    opportunities: [],
    employerOpportunities: [],
    currentUser: null,
    activeView: 'home',
    selectedOpportunityId: null,
    pendingApplyId: null,
    pendingRecommendationPeerId: null,
    pendingCuratorUserId: null,
    pendingCuratorOpportunityId: null,
    pendingEmployerOpportunityId: null,
    responses: [],
    contacts: [],
    contactSuggestions: [],
    recommendations: [],
    employerResponses: [],
    curatorUsers: [],
    curatorOpportunities: [],
    profile: null,
    favoriteOpportunityIds: [],
    favoriteCompanyIds: [],
    opportunityFilters: {
        type: '',
        workFormat: '',
        location: '',
        search: '',
        favorites: '',
    },
    employerResponseFilters: {
        status: '',
        search: '',
    },
    contactSearch: '',
    employerOpportunityFilters: {
        status: '',
        type: '',
        search: '',
    },
    curatorFilters: {
        role: 'employer',
        userSearch: '',
        verification: '',
        opportunitySearch: '',
        opportunityStatus: '',
    },
};

let map;
let ymapsReadyPromise;
let placemarks = [];
let loginModal;
let registerModal;
let applyModal;
let recommendModal;
let curatorUserModal;
let curatorOpportunityModal;
let employerOpportunityModal;

function el(id) {
    return document.getElementById(id);
}

function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function visibleViews() {
    const views = ['home'];
    if (!state.currentUser) return views;

    views.push('profile');
    if (state.currentUser.role === 'applicant') {
        views.push('applicant');
    }
    if (state.currentUser.role === 'employer') {
        views.push('employer');
    }
    if (['curator', 'admin'].includes(state.currentUser.role)) {
        views.push('curator');
    }
    return views;
}

function setActiveView(view) {
    const allowedViews = visibleViews();
    state.activeView = allowedViews.includes(view) ? view : 'home';
    renderWorkspaceNav();
    renderWorkspaceView();
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

function loadFavoriteIds(key) {
    try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((value) => Number.isInteger(value)) : [];
    } catch {
        return [];
    }
}

function saveFavoriteIds(key, ids) {
    localStorage.setItem(key, JSON.stringify(ids));
}

function loadFavoritesState() {
    state.favoriteOpportunityIds = loadFavoriteIds(FAVORITE_OPPORTUNITIES_KEY);
    state.favoriteCompanyIds = loadFavoriteIds(FAVORITE_COMPANIES_KEY);
}

function isFavoriteOpportunity(opportunityId) {
    return state.favoriteOpportunityIds.includes(opportunityId);
}

function isFavoriteCompany(employerId) {
    return state.favoriteCompanyIds.includes(employerId);
}

function toggleFavoriteOpportunity(opportunityId) {
    if (isFavoriteOpportunity(opportunityId)) {
        state.favoriteOpportunityIds = state.favoriteOpportunityIds.filter((id) => id !== opportunityId);
    } else {
        state.favoriteOpportunityIds = [...state.favoriteOpportunityIds, opportunityId];
    }
    saveFavoriteIds(FAVORITE_OPPORTUNITIES_KEY, state.favoriteOpportunityIds);
    renderOpportunitiesSection();
}

function toggleFavoriteCompany(employerId) {
    if (isFavoriteCompany(employerId)) {
        state.favoriteCompanyIds = state.favoriteCompanyIds.filter((id) => id !== employerId);
    } else {
        state.favoriteCompanyIds = [...state.favoriteCompanyIds, employerId];
    }
    saveFavoriteIds(FAVORITE_COMPANIES_KEY, state.favoriteCompanyIds);
    renderOpportunitiesSection();
}

function hasCoords(opportunity) {
    return Number.isFinite(opportunity.lat) && Number.isFinite(opportunity.lng);
}

function selectedOpportunity() {
    return state.opportunities.find((item) => item.id === state.selectedOpportunityId) || null;
}

function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getToken();
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(`${API_BASE}${path}`, { ...options, headers });
}

function normalizeText(value) {
    const text = (value || '').trim();
    return text || null;
}

function normalizeUrl(value) {
    const text = (value || '').trim();
    return text || null;
}

function toDateTimeLocalValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

function includesText(haystack, needle) {
    return (haystack || '').toLowerCase().includes((needle || '').toLowerCase());
}

function formatDate(dateString) {
    if (!dateString) return 'Без срока';
    return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function renderAlert(container, kind, text) {
    container.innerHTML = '';
    container.appendChild(createEl('div', `alert alert-${kind} mb-0`, text));
}

function showNotice(kind, text) {
    const container = el('app-notice');
    if (!container) return;

    container.innerHTML = '';
    const alert = createEl('div', `alert alert-${kind} alert-dismissible fade show`, text);
    alert.setAttribute('role', 'alert');

    const closeBtn = createEl('button', 'btn-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('data-bs-dismiss', 'alert');
    closeBtn.setAttribute('aria-label', 'Закрыть');
    alert.appendChild(closeBtn);

    container.appendChild(alert);

    window.setTimeout(() => {
        if (!alert.isConnected) return;
        const instance = window.bootstrap.Alert.getOrCreateInstance(alert);
        instance.close();
    }, 3500);
}

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
        controls: ['zoomControl'],
    });
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
            state.selectedOpportunityId = opportunity.id;
            renderSelectedOpportunity();
            renderOpportunitiesSection();
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

function renderList(opportunities) {
    const list = el('opportunities-list');
    list.innerHTML = '';

    if (!opportunities.length) {
        list.appendChild(createEl('div', 'list-group-item empty-state', 'Нет доступных возможностей'));
        return;
    }

    opportunities.forEach((opportunity) => {
        const favoriteOpportunity = isFavoriteOpportunity(opportunity.id);
        const favoriteCompany = isFavoriteCompany(opportunity.employer_id);
        const item = createEl(
            'a',
            `list-group-item list-group-item-action opportunity-item${state.selectedOpportunityId === opportunity.id ? ' active' : ''}${favoriteOpportunity ? ' favorite-opportunity' : ''}${!favoriteOpportunity && favoriteCompany ? ' favorite-company' : ''}`
        );
        item.href = '#';

        const shortDesc = opportunity.description.length > 120
            ? `${opportunity.description.slice(0, 120)}...`
            : opportunity.description;

        const header = createEl('div', 'd-flex w-100 justify-content-between gap-2');
        const titleWrap = createEl('div');
        titleWrap.appendChild(createEl('h6', 'mb-1', opportunity.title));
        titleWrap.appendChild(createEl('div', 'small text-muted', opportunity.employer_name || 'Работодатель'));
        header.appendChild(titleWrap);

        const badges = createEl('div', 'd-flex flex-wrap gap-1 justify-content-end');
        badges.appendChild(createEl('small', 'badge bg-secondary', opportunityTypeLabel(opportunity.type)));
        if (favoriteOpportunity) {
            badges.appendChild(createEl('small', 'badge text-bg-danger', 'Избр. вакансия'));
        } else if (favoriteCompany) {
            badges.appendChild(createEl('small', 'badge text-bg-warning', 'Избр. компания'));
        }
        header.appendChild(badges);

        const desc = createEl('p', 'mb-1', shortDesc);
        const meta = createEl('small');
        const icon = createEl('i', 'bi bi-geo-alt');
        meta.appendChild(icon);
        meta.append(` ${opportunity.location} | ${workFormatLabel(opportunity.work_format)}`);
        if (opportunity.salary_range) {
            meta.append(` | ${opportunity.salary_range}`);
        }

        item.appendChild(header);
        item.appendChild(desc);
        item.appendChild(meta);

        item.addEventListener('click', (event) => {
            event.preventDefault();
            state.selectedOpportunityId = opportunity.id;
            renderSelectedOpportunity();
            renderList(opportunities);
            centerOnOpportunity(opportunity);
            renderMap(opportunities);
        });

        list.appendChild(item);
    });
}

function getFilteredOpportunities() {
    const filters = state.opportunityFilters;
    return state.opportunities.filter((opportunity) => {
        if (filters.type && opportunity.type !== filters.type) return false;
        if (filters.workFormat && opportunity.work_format !== filters.workFormat) return false;
        if (filters.location && !includesText(opportunity.location, filters.location)) return false;
        if (filters.favorites === 'vacancies' && !isFavoriteOpportunity(opportunity.id)) return false;
        if (filters.favorites === 'companies' && !isFavoriteCompany(opportunity.employer_id)) return false;
        if (filters.favorites === 'all' && !isFavoriteOpportunity(opportunity.id) && !isFavoriteCompany(opportunity.employer_id)) return false;
        if (filters.search) {
            const tags = Array.isArray(opportunity.tags) ? opportunity.tags.map((tag) => tag.name).join(' ') : '';
            const text = [
                opportunity.title,
                opportunity.employer_name,
                opportunity.description,
                opportunity.location,
                opportunity.type,
                opportunity.work_format,
                tags,
            ].join(' ');
            if (!includesText(text, filters.search)) return false;
        }
        return true;
    });
}

function syncSelectedOpportunity(filteredOpportunities) {
    if (!filteredOpportunities.length) {
        state.selectedOpportunityId = null;
        return;
    }
    const selectedStillVisible = filteredOpportunities.some((item) => item.id === state.selectedOpportunityId);
    if (!selectedStillVisible) {
        state.selectedOpportunityId = filteredOpportunities[0].id;
    }
}

function renderOpportunitiesSection() {
    const filtered = getFilteredOpportunities();
    syncSelectedOpportunity(filtered);
    renderList(filtered);
    renderSelectedOpportunity();
    renderMap(filtered);
    renderFavoritesSummary();
}

function applyOpportunityFilters() {
    state.opportunityFilters.type = el('filterType').value;
    state.opportunityFilters.workFormat = el('filterWorkFormat').value;
    state.opportunityFilters.location = el('filterLocation').value.trim();
    state.opportunityFilters.search = el('filterSearch').value.trim();
    state.opportunityFilters.favorites = el('filterFavorites').value;
    renderOpportunitiesSection();
}

function resetOpportunityFilters() {
    el('filterType').value = '';
    el('filterWorkFormat').value = '';
    el('filterLocation').value = '';
    el('filterSearch').value = '';
    el('filterFavorites').value = '';
    applyOpportunityFilters();
}

function renderFavoritesSummary() {
    const container = el('favorites-summary');
    const badge = el('favoriteSummaryBadge');
    container.innerHTML = '';

    const favoriteOpportunities = state.opportunities.filter((item) => isFavoriteOpportunity(item.id));
    const favoriteCompanies = state.favoriteCompanyIds
        .map((companyId) => state.opportunities.find((item) => item.employer_id === companyId))
        .filter(Boolean);

    badge.textContent = String(favoriteOpportunities.length + favoriteCompanies.length);

    if (!favoriteOpportunities.length && !favoriteCompanies.length) {
        container.appendChild(createEl('p', 'text-muted mb-0', 'Пока ничего не добавлено в избранное.'));
        return;
    }

    favoriteCompanies.forEach((companyOpportunity) => {
        const chip = createEl('button', 'favorite-chip company', companyOpportunity.employer_name || 'Работодатель');
        chip.type = 'button';
        chip.addEventListener('click', () => {
            el('filterFavorites').value = 'companies';
            state.opportunityFilters.favorites = 'companies';
            renderOpportunitiesSection();
        });
        container.appendChild(chip);
    });

    favoriteOpportunities.forEach((opportunity) => {
        const chip = createEl('button', 'favorite-chip opportunity', opportunity.title);
        chip.type = 'button';
        chip.addEventListener('click', () => {
            state.selectedOpportunityId = opportunity.id;
            renderOpportunitiesSection();
            centerOnOpportunity(opportunity);
        });
        container.appendChild(chip);
    });
}

function renderSelectedOpportunity() {
    const container = el('opportunity-details');
    const opportunity = selectedOpportunity();
    container.innerHTML = '';

    if (!opportunity) {
        container.appendChild(createEl('h5', 'card-title', 'Выбери возможность'));
        container.appendChild(createEl('p', 'text-muted mb-0', 'Здесь появятся детали вакансии и кнопка отклика.'));
        return;
    }

    container.appendChild(createEl('h5', 'card-title', opportunity.title));
    container.appendChild(createEl('p', 'detail-meta mb-1', opportunity.employer_name || 'Работодатель'));
    container.appendChild(createEl('p', 'detail-meta mb-2', `${opportunityTypeLabel(opportunity.type)} | ${workFormatLabel(opportunity.work_format)} | ${opportunity.location}`));
    container.appendChild(createEl('p', 'mb-3', opportunity.description));

    const metaList = createEl('div', 'small text-muted mb-3');
    metaList.appendChild(createEl('div', '', `Публикация: ${formatDate(opportunity.published_at)}`));
    metaList.appendChild(createEl('div', '', `Срок отклика: ${formatDate(opportunity.expires_at)}`));
    if (opportunity.salary_range) {
        metaList.appendChild(createEl('div', '', `Вознаграждение: ${opportunity.salary_range}`));
    }
    container.appendChild(metaList);

    if (Array.isArray(opportunity.tags) && opportunity.tags.length) {
        const tagsRow = createEl('div', 'd-flex flex-wrap gap-2 mb-3');
        opportunity.tags.forEach((tag) => {
            tagsRow.appendChild(createEl('span', 'badge text-bg-light', `#${tag.name}`));
        });
        container.appendChild(tagsRow);
    }

    const actionWrap = createEl('div', 'd-flex flex-wrap gap-2 align-items-center');

    const favoriteOpportunityBtn = createEl(
        'button',
        isFavoriteOpportunity(opportunity.id) ? 'btn btn-danger' : 'btn btn-outline-danger',
        isFavoriteOpportunity(opportunity.id) ? 'Убрать вакансию из избранного' : 'В избранное: вакансия'
    );
    favoriteOpportunityBtn.type = 'button';
    favoriteOpportunityBtn.addEventListener('click', () => toggleFavoriteOpportunity(opportunity.id));
    actionWrap.appendChild(favoriteOpportunityBtn);

    const favoriteCompanyBtn = createEl(
        'button',
        isFavoriteCompany(opportunity.employer_id) ? 'btn btn-warning' : 'btn btn-outline-warning',
        isFavoriteCompany(opportunity.employer_id) ? 'Убрать компанию из избранного' : 'В избранное: компания'
    );
    favoriteCompanyBtn.type = 'button';
    favoriteCompanyBtn.addEventListener('click', () => toggleFavoriteCompany(opportunity.employer_id));
    actionWrap.appendChild(favoriteCompanyBtn);

    if (!state.currentUser) {
        actionWrap.appendChild(createEl('span', 'text-muted small', 'Войди как соискатель, чтобы откликнуться.'));
    } else if (state.currentUser.role !== 'applicant') {
        actionWrap.appendChild(createEl('span', 'text-muted small', 'Отклик доступен только для аккаунта соискателя.'));
    } else {
        const applyBtn = createEl('button', 'btn btn-primary', 'Откликнуться');
        applyBtn.type = 'button';
        applyBtn.addEventListener('click', () => openApplyModal(opportunity.id));
        actionWrap.appendChild(applyBtn);
    }

    const focusBtn = createEl('button', 'btn btn-outline-secondary', 'Показать на карте');
    focusBtn.type = 'button';
    focusBtn.disabled = !hasCoords(opportunity);
    focusBtn.addEventListener('click', () => centerOnOpportunity(opportunity));
    actionWrap.appendChild(focusBtn);

    if (state.currentUser?.role === 'employer' && state.currentUser.id === opportunity.employer_id) {
        const editBtn = createEl('button', 'btn btn-outline-primary', 'Редактировать мою карточку');
        editBtn.type = 'button';
        editBtn.addEventListener('click', () => openEmployerOpportunityModal(opportunity.id));
        actionWrap.appendChild(editBtn);
    }

    container.appendChild(actionWrap);
    renderContactsSection();
}

function statusLabel(status) {
    if (status === 'accepted') return 'Принят';
    if (status === 'rejected') return 'Отклонен';
    if (status === 'reserve') return 'В резерве';
    return 'На рассмотрении';
}

function contactStatusLabel(status) {
    if (status === 'accepted') return 'Контакт подтвержден';
    if (status === 'declined') return 'Заявка отклонена';
    return 'Заявка отправлена';
}

function curatorRoleLabel(role) {
    if (role === 'employer') return 'Работодатель';
    if (role === 'applicant') return 'Соискатель';
    if (role === 'curator') return 'Куратор';
    if (role === 'admin') return 'Администратор';
    return role;
}

function currentRoleLabel(role) {
    if (role === 'applicant') return 'Соискатель';
    if (role === 'employer') return 'Работодатель';
    if (role === 'curator') return 'Куратор';
    if (role === 'admin') return 'Администратор';
    return role;
}

function opportunityTypeLabel(type) {
    if (type === 'internship') return 'Стажировка';
    if (type === 'job') return 'Работа';
    if (type === 'mentorship') return 'Менторство';
    if (type === 'event') return 'Событие';
    return type;
}

function workFormatLabel(workFormat) {
    if (workFormat === 'office') return 'Офис';
    if (workFormat === 'hybrid') return 'Гибрид';
    if (workFormat === 'remote') return 'Удаленно';
    return workFormat;
}

function renderResponses() {
    const container = el('responses-list');
    const refreshBtn = el('refreshResponsesBtn');
    container.innerHTML = '';

    if (!state.currentUser || state.currentUser.role !== 'applicant') {
        refreshBtn.classList.add('d-none');
        container.appendChild(createEl('p', 'text-muted mb-0', 'Войди как соискатель, чтобы видеть свои отклики.'));
        return;
    }

    refreshBtn.classList.remove('d-none');

    if (!state.responses.length) {
        container.appendChild(createEl('p', 'text-muted mb-0', 'Откликов пока нет.'));
        return;
    }

    state.responses.forEach((response) => {
        const item = createEl('div', 'response-item py-2');
        const title = state.opportunities.find((opportunity) => opportunity.id === response.opportunity_id)?.title
            || `Вакансия #${response.opportunity_id}`;

        const top = createEl('div', 'd-flex justify-content-between align-items-start gap-2');
        top.appendChild(createEl('div', 'fw-semibold', title));
        top.appendChild(createEl('span', `status-pill ${response.status}`, statusLabel(response.status)));

        item.appendChild(top);
        item.appendChild(createEl('div', 'small text-muted mt-1', `Отправлен: ${formatDate(response.created_at)}`));

        if (response.cover_letter) {
            item.appendChild(createEl('div', 'small mt-2', response.cover_letter));
        }

        container.appendChild(item);
    });
}

async function sendContactRequest(addresseeId) {
    const response = await apiFetch('/contacts/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addressee_id: addresseeId }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось отправить заявку в контакты.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось отправить заявку в контакты.');
        return;
    }

    await loadContacts();
    showNotice('success', 'Заявка в контакты отправлена.');
}

async function updateContactStatus(contactId, status) {
    const response = await apiFetch(`/contacts/${contactId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось обновить статус контакта.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось обновить статус контакта.');
        return;
    }

    await loadContacts();
    showNotice('success', status === 'accepted' ? 'Контакт подтвержден.' : 'Заявка отклонена.');
}

function openRecommendModal(peerId) {
    const contact = state.contacts.find((item) => item.peer.id === peerId && item.status === 'accepted');
    const opportunity = selectedOpportunity();
    if (!contact) {
        showNotice('danger', 'Сначала нужен подтвержденный контакт.');
        return;
    }
    if (!opportunity) {
        showNotice('danger', 'Сначала выбери вакансию или мероприятие на главной.');
        return;
    }

    state.pendingRecommendationPeerId = peerId;
    el('recommendPeerMeta').textContent = `Кому: ${contact.peer.applicant_profile?.full_name || contact.peer.display_name}`;
    el('recommendOpportunityMeta').textContent = `Что рекомендуешь: ${opportunity.title} | ${opportunity.employer_name}`;
    el('recommendMessage').value = '';
    recommendModal.show();
}

async function handleRecommendationSubmit(event) {
    event.preventDefault();
    const opportunity = selectedOpportunity();
    if (!state.pendingRecommendationPeerId || !opportunity) {
        showNotice('danger', 'Не удалось определить контакт или выбранную возможность.');
        return;
    }

    const response = await apiFetch('/recommendations/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recommended_user_id: state.pendingRecommendationPeerId,
            opportunity_id: opportunity.id,
            message: normalizeText(el('recommendMessage').value),
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось отправить рекомендацию.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось отправить рекомендацию.');
        return;
    }

    recommendModal.hide();
    event.target.reset();
    state.pendingRecommendationPeerId = null;
    await loadRecommendations();
    showNotice('success', 'Рекомендация отправлена контакту.');
}

function renderContactsSection() {
    const suggestionsContainer = el('contact-suggestions-list');
    const contactsContainer = el('contacts-list');
    const recommendationsContainer = el('recommendations-list');
    const refreshBtn = el('refreshContactsBtn');
    suggestionsContainer.innerHTML = '';
    contactsContainer.innerHTML = '';
    recommendationsContainer.innerHTML = '';

    if (!state.currentUser || state.currentUser.role !== 'applicant') {
        refreshBtn.classList.add('d-none');
        suggestionsContainer.appendChild(createEl('p', 'text-muted mb-0', 'Войди как соискатель, чтобы расширять сеть контактов.'));
        contactsContainer.appendChild(createEl('p', 'text-muted mb-0', 'Контакты и заявки в сеть появятся после входа.'));
        recommendationsContainer.appendChild(createEl('p', 'text-muted mb-0', 'Рекомендации появятся после входа.'));
        return;
    }

    refreshBtn.classList.remove('d-none');

    if (!state.contactSuggestions.length) {
        suggestionsContainer.appendChild(createEl('p', 'text-muted mb-0', 'Подходящих открытых профилей пока нет или все уже у тебя в сети.'));
    } else {
        state.contactSuggestions.forEach((person) => {
            const item = createEl('div', 'contact-item py-2');
            const top = createEl('div', 'd-flex justify-content-between align-items-start gap-2');
            top.appendChild(createEl('div', 'fw-semibold', person.applicant_profile?.full_name || person.display_name));
            top.appendChild(createEl('span', 'status-pill pending', 'Открытый профиль'));
            item.appendChild(top);

            const metaParts = [
                person.display_name,
                person.applicant_profile?.university,
                person.applicant_profile?.course_or_year,
            ].filter(Boolean);
            if (metaParts.length) {
                item.appendChild(createEl('div', 'small text-muted mt-1', metaParts.join(' | ')));
            }
            if (person.applicant_profile?.skills) {
                item.appendChild(createEl('div', 'small mt-1', `Навыки: ${person.applicant_profile.skills}`));
            }
            if (person.applicant_profile?.bio) {
                item.appendChild(createEl('div', 'small text-muted mt-1', person.applicant_profile.bio));
            }

            const action = createEl('div', 'contact-actions');
            const requestBtn = createEl('button', 'btn btn-sm btn-outline-primary', 'Добавить в контакты');
            requestBtn.type = 'button';
            requestBtn.addEventListener('click', () => {
                void sendContactRequest(person.id);
            });
            action.appendChild(requestBtn);
            item.appendChild(action);
            suggestionsContainer.appendChild(item);
        });
    }

    if (!state.contacts.length) {
        contactsContainer.appendChild(createEl('p', 'text-muted mb-0', 'Пока нет ни входящих, ни подтвержденных контактов.'));
        return;
    }

    state.contacts.forEach((contact) => {
        const item = createEl('div', 'contact-item py-2');
        const top = createEl('div', 'd-flex justify-content-between align-items-start gap-2');
        top.appendChild(createEl('div', 'fw-semibold', contact.peer.applicant_profile?.full_name || contact.peer.display_name));
        const pillClass = contact.status === 'accepted' ? 'accepted' : contact.status === 'declined' ? 'rejected' : 'pending';
        top.appendChild(createEl('span', `status-pill ${pillClass}`, contactStatusLabel(contact.status)));
        item.appendChild(top);

        const directionText = contact.direction === 'incoming' ? 'Входящая заявка' : 'Исходящая заявка';
        const metaParts = [
            directionText,
            contact.peer.applicant_profile?.university,
            contact.peer.applicant_profile?.course_or_year,
        ].filter(Boolean);
        item.appendChild(createEl('div', 'small text-muted mt-1', metaParts.join(' | ')));

        if (contact.peer.applicant_profile?.skills) {
            item.appendChild(createEl('div', 'small mt-1', `Навыки: ${contact.peer.applicant_profile.skills}`));
        }
        if (contact.peer.applicant_profile?.bio) {
            item.appendChild(createEl('div', 'small text-muted mt-1', contact.peer.applicant_profile.bio));
        }

        if (contact.direction === 'incoming' && contact.status === 'pending') {
            const actions = createEl('div', 'contact-actions');
            const acceptBtn = createEl('button', 'btn btn-sm btn-outline-success', 'Принять');
            acceptBtn.type = 'button';
            acceptBtn.addEventListener('click', () => {
                void updateContactStatus(contact.id, 'accepted');
            });
            actions.appendChild(acceptBtn);

            const declineBtn = createEl('button', 'btn btn-sm btn-outline-danger', 'Отклонить');
            declineBtn.type = 'button';
            declineBtn.addEventListener('click', () => {
                void updateContactStatus(contact.id, 'declined');
            });
            actions.appendChild(declineBtn);
            item.appendChild(actions);
        } else if (contact.status === 'accepted') {
            const actions = createEl('div', 'contact-actions');
            const recommendBtn = createEl('button', 'btn btn-sm btn-outline-primary', 'Рекомендовать выбранную карточку');
            recommendBtn.type = 'button';
            recommendBtn.disabled = !selectedOpportunity();
            recommendBtn.addEventListener('click', () => {
                openRecommendModal(contact.peer.id);
            });
            actions.appendChild(recommendBtn);
            item.appendChild(actions);
        }

        contactsContainer.appendChild(item);
    });

    if (!state.recommendations.length) {
        recommendationsContainer.appendChild(createEl('p', 'text-muted mb-0', 'Ты еще не отправлял и не получал рекомендации.'));
        return;
    }

    state.recommendations.forEach((recommendation) => {
        const item = createEl('div', 'contact-item py-2');
        const top = createEl('div', 'd-flex justify-content-between align-items-start gap-2');
        top.appendChild(createEl('div', 'fw-semibold', recommendation.opportunity.title));
        top.appendChild(
            createEl(
                'span',
                `status-pill ${recommendation.direction === 'incoming' ? 'accepted' : 'pending'}`,
                recommendation.direction === 'incoming' ? 'Рекомендовано тебе' : 'Ты рекомендовал'
            )
        );
        item.appendChild(top);
        item.appendChild(
            createEl(
                'div',
                'small text-muted mt-1',
                `${recommendation.peer.display_name} | ${opportunityTypeLabel(recommendation.opportunity.type)} | ${recommendation.opportunity.employer_name}`
            )
        );
        item.appendChild(
            createEl(
                'div',
                'small text-muted',
                `${workFormatLabel(recommendation.opportunity.work_format)} | ${recommendation.opportunity.location}`
            )
        );
        if (recommendation.message) {
            item.appendChild(createEl('div', 'small mt-2', recommendation.message));
        }
        recommendationsContainer.appendChild(item);
    });
}

async function updateEmployerResponseStatus(responseId, status) {
    const response = await apiFetch(`/responses/${responseId}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось обновить статус.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось обновить статус.');
        return;
    }

    await loadEmployerResponses();
    showNotice('success', 'Статус отклика обновлен.');
}

function renderEmployerResponses() {
    const container = el('employer-responses-list');
    const refreshBtn = el('refreshEmployerResponsesBtn');
    container.innerHTML = '';

    if (!state.currentUser || state.currentUser.role !== 'employer') {
        refreshBtn.classList.add('d-none');
        container.appendChild(createEl('p', 'text-muted mb-0', 'Войди как работодатель, чтобы видеть входящие отклики.'));
        return;
    }

    refreshBtn.classList.remove('d-none');

    const filteredResponses = getFilteredEmployerResponses();

    if (!state.employerResponses.length) {
        container.appendChild(createEl('p', 'text-muted mb-0', 'Пока нет входящих откликов.'));
        return;
    }

    if (!filteredResponses.length) {
        container.appendChild(createEl('p', 'text-muted mb-0', 'По текущим фильтрам откликов не найдено.'));
        return;
    }

    filteredResponses.forEach((response) => {
        const item = createEl('div', 'response-item py-2');
        const top = createEl('div', 'd-flex justify-content-between align-items-start gap-2');
        top.appendChild(createEl('div', 'fw-semibold', response.opportunity_title));
        top.appendChild(createEl('span', `status-pill ${response.status}`, statusLabel(response.status)));

        item.appendChild(top);
        item.appendChild(createEl('div', 'small text-muted mt-1', `${response.applicant_name} (${response.applicant_email})`));
        item.appendChild(createEl('div', 'small text-muted', `Отклик: ${formatDate(response.created_at)}`));

        if (response.cover_letter) {
            item.appendChild(createEl('div', 'small mt-2', response.cover_letter));
        }

        const actions = createEl('div', 'response-actions');
        const statuses = [
            { value: 'pending', label: 'На рассмотрение', style: 'outline-secondary' },
            { value: 'accepted', label: 'Принять', style: 'outline-success' },
            { value: 'rejected', label: 'Отклонить', style: 'outline-danger' },
            { value: 'reserve', label: 'Резерв', style: 'outline-warning' },
        ];

        statuses.forEach(({ value, label, style }) => {
            const button = createEl(
                'button',
                `btn btn-sm ${response.status === value ? 'btn-' + style.replace('outline-', '') : 'btn-' + style}`,
                label
            );
            button.type = 'button';
            if (response.status === value) {
                button.disabled = true;
            } else {
                button.addEventListener('click', () => {
                    void updateEmployerResponseStatus(response.id, value);
                });
            }
            actions.appendChild(button);
        });

        item.appendChild(actions);
        container.appendChild(item);
    });
}

function getFilteredEmployerOpportunities() {
    const filters = state.employerOpportunityFilters;
    return state.employerOpportunities.filter((opportunity) => {
        if (filters.status === 'active' && !opportunity.is_active) return false;
        if (filters.status === 'inactive' && opportunity.is_active) return false;
        if (filters.type && opportunity.type !== filters.type) return false;
        if (filters.search) {
            const haystack = `${opportunity.title} ${opportunity.description} ${opportunity.location} ${opportunity.salary_range || ''}`;
            if (!includesText(haystack, filters.search)) return false;
        }
        return true;
    });
}

function renderEmployerOpportunities() {
    const container = el('employer-opportunities-list');
    const refreshBtn = el('refreshEmployerOpportunitiesBtn');
    const createBtn = el('openEmployerOpportunityCreateBtn');
    container.innerHTML = '';

    if (!state.currentUser || state.currentUser.role !== 'employer') {
        refreshBtn.classList.add('d-none');
        createBtn.classList.add('d-none');
        container.appendChild(createEl('p', 'text-muted mb-0', 'Войди как работодатель, чтобы создавать и редактировать свои карточки.'));
        return;
    }

    refreshBtn.classList.remove('d-none');
    createBtn.classList.remove('d-none');
    createBtn.disabled = !state.currentUser.is_verified;

    if (!state.currentUser.is_verified) {
        container.appendChild(createEl('p', 'text-muted mb-2', 'После верификации компании куратором здесь станет доступно создание новых карточек.'));
    }

    if (!state.employerOpportunities.length) {
        container.appendChild(createEl('p', 'text-muted mb-0', 'Пока нет созданных карточек. Создай первую возможность для студентов и выпускников.'));
        return;
    }

    const filtered = getFilteredEmployerOpportunities();
    if (!filtered.length) {
        container.appendChild(createEl('p', 'text-muted mb-0', 'По текущим фильтрам карточки не найдены.'));
        return;
    }

    filtered.forEach((opportunity) => {
        const item = createEl('div', 'opportunity-manage-item py-2');
        const top = createEl('div', 'd-flex justify-content-between align-items-start gap-2');
        top.appendChild(createEl('div', 'fw-semibold', opportunity.title));
        top.appendChild(createEl('span', `status-pill ${opportunity.is_active ? 'accepted' : 'rejected'}`, opportunity.is_active ? 'Активна' : 'Закрыта'));
        item.appendChild(top);
        item.appendChild(createEl('div', 'opportunity-manage-meta mt-1', `${opportunityTypeLabel(opportunity.type)} | ${workFormatLabel(opportunity.work_format)} | ${opportunity.location}`));

        const secondaryMeta = [];
        if (opportunity.salary_range) secondaryMeta.push(opportunity.salary_range);
        if (opportunity.expires_at) secondaryMeta.push(`До ${formatDate(opportunity.expires_at)}`);
        if (opportunity.event_date) secondaryMeta.push(`Событие ${formatDate(opportunity.event_date)}`);
        if (secondaryMeta.length) {
            item.appendChild(createEl('div', 'small text-muted mt-1', secondaryMeta.join(' | ')));
        }

        item.appendChild(
            createEl(
                'div',
                'small mt-1',
                opportunity.description.length > 140 ? `${opportunity.description.slice(0, 140)}...` : opportunity.description
            )
        );

        const actions = createEl('div', 'opportunity-manage-actions');
        const editBtn = createEl('button', 'btn btn-sm btn-outline-primary', 'Редактировать');
        editBtn.type = 'button';
        editBtn.addEventListener('click', () => openEmployerOpportunityModal(opportunity.id));
        actions.appendChild(editBtn);

        const toggleBtn = createEl(
            'button',
            `btn btn-sm ${opportunity.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`,
            opportunity.is_active ? 'Перевести в архив' : 'Опубликовать'
        );
        toggleBtn.type = 'button';
        toggleBtn.addEventListener('click', () => {
            void saveEmployerOpportunity({
                id: opportunity.id,
                payload: { is_active: !opportunity.is_active },
                successMessage: opportunity.is_active ? 'Карточка переведена в архив.' : 'Карточка снова опубликована.',
            });
        });
        actions.appendChild(toggleBtn);

        const deleteBtn = createEl('button', 'btn btn-sm btn-outline-danger', 'Удалить');
        deleteBtn.type = 'button';
        deleteBtn.addEventListener('click', () => {
            void deleteEmployerOpportunity(opportunity.id);
        });
        actions.appendChild(deleteBtn);

        item.appendChild(actions);
        container.appendChild(item);
    });
}

async function updateCuratorUser(userId, payload) {
    const response = await apiFetch(`/curator/users/${userId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось обновить пользователя.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось обновить пользователя.');
        return;
    }

    await loadCuratorData();
    showNotice('success', 'Пользователь обновлен.');
}

async function updateCuratorOpportunity(opportunityId, payload) {
    const response = await apiFetch(`/curator/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось обновить карточку.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось обновить карточку.');
        return;
    }

    await loadCuratorData();
    await loadOpportunities();
    showNotice('success', 'Карточка обновлена.');
}

function getFilteredCuratorUsers() {
    const filters = state.curatorFilters;
    return state.curatorUsers.filter((user) => {
        if (filters.role && user.role !== filters.role) return false;
        if (filters.verification === 'verified' && !user.is_verified) return false;
        if (filters.verification === 'unverified' && user.is_verified) return false;
        if (filters.verification === 'pending' && (user.role !== 'employer' || user.is_verified)) return false;
        if (filters.userSearch) {
            const haystack = `${user.display_name} ${user.email}`;
            if (!includesText(haystack, filters.userSearch)) return false;
        }
        return true;
    });
}

function getFilteredCuratorOpportunities() {
    const filters = state.curatorFilters;
    return state.curatorOpportunities.filter((opportunity) => {
        if (filters.opportunityStatus === 'active' && !opportunity.is_active) return false;
        if (filters.opportunityStatus === 'inactive' && opportunity.is_active) return false;
        if (filters.opportunitySearch) {
            const haystack = `${opportunity.title} ${opportunity.employer_name} ${opportunity.location} ${opportunity.description}`;
            if (!includesText(haystack, filters.opportunitySearch)) return false;
        }
        return true;
    });
}

function renderCuratorSection() {
    const refreshBtn = el('refreshCuratorBtn');
    const usersContainer = el('curator-users-list');
    const opportunitiesContainer = el('curator-opportunities-list');
    usersContainer.innerHTML = '';
    opportunitiesContainer.innerHTML = '';

    if (!state.currentUser || !['curator', 'admin'].includes(state.currentUser.role)) {
        refreshBtn.classList.add('d-none');
        usersContainer.appendChild(createEl('p', 'text-muted mb-0', 'Войди как куратор, чтобы модерировать пользователей.'));
        opportunitiesContainer.appendChild(createEl('p', 'text-muted mb-0', 'Карточки для модерации появятся здесь.'));
        return;
    }

    refreshBtn.classList.remove('d-none');

    const filteredUsers = getFilteredCuratorUsers();
    if (!filteredUsers.length) {
        usersContainer.appendChild(createEl('p', 'text-muted mb-0', 'Пользователи по текущим фильтрам не найдены.'));
    } else {
        filteredUsers.forEach((user) => {
            const item = createEl('div', 'moderation-item py-2');
            const top = createEl('div', 'd-flex justify-content-between align-items-start gap-2');
            top.appendChild(createEl('div', 'fw-semibold', user.display_name));
            top.appendChild(createEl('span', `status-pill ${user.is_active ? 'accepted' : 'rejected'}`, user.is_active ? 'Активен' : 'Отключен'));
            item.appendChild(top);
            item.appendChild(createEl('div', 'moderation-meta mt-1', `${curatorRoleLabel(user.role)} | ${user.email}`));

            if (user.role === 'employer') {
                const verificationText = user.is_verified ? 'Компания верифицирована' : 'Ожидает верификации';
                item.appendChild(createEl('div', 'moderation-meta', verificationText));
                if (user.employer_profile?.company_name) {
                    item.appendChild(createEl('div', 'small mt-1', user.employer_profile.company_name));
                }
            }

            const actions = createEl('div', 'moderation-actions');
            const editBtn = createEl('button', 'btn btn-sm btn-outline-primary', 'Проверить');
            editBtn.type = 'button';
            editBtn.disabled = user.role !== 'employer';
            if (user.role === 'employer') {
                editBtn.addEventListener('click', () => openCuratorUserModal(user.id));
            }
            actions.appendChild(editBtn);

            const verifyBtn = createEl(
                'button',
                `btn btn-sm ${user.is_verified ? 'btn-outline-secondary' : 'btn-outline-success'}`,
                user.is_verified ? 'Снять верификацию' : 'Верифицировать'
            );
            verifyBtn.type = 'button';
            verifyBtn.disabled = user.role !== 'employer';
            if (user.role === 'employer') {
                verifyBtn.addEventListener('click', () => {
                    void updateCuratorUser(user.id, { is_verified: !user.is_verified });
                });
            }
            actions.appendChild(verifyBtn);

            const activeBtn = createEl(
                'button',
                `btn btn-sm ${user.is_active ? 'btn-outline-danger' : 'btn-outline-primary'}`,
                user.is_active ? 'Отключить' : 'Активировать'
            );
            activeBtn.type = 'button';
            activeBtn.addEventListener('click', () => {
                void updateCuratorUser(user.id, { is_active: !user.is_active });
            });
            actions.appendChild(activeBtn);

            item.appendChild(actions);
            usersContainer.appendChild(item);
        });
    }

    const filteredOpportunities = getFilteredCuratorOpportunities();
    if (!filteredOpportunities.length) {
        opportunitiesContainer.appendChild(createEl('p', 'text-muted mb-0', 'Карточки по текущим фильтрам не найдены.'));
        return;
    }

    filteredOpportunities.forEach((opportunity) => {
        const item = createEl('div', 'moderation-item py-2');
        const top = createEl('div', 'd-flex justify-content-between align-items-start gap-2');
        top.appendChild(createEl('div', 'fw-semibold', opportunity.title));
        top.appendChild(createEl('span', `status-pill ${opportunity.is_active ? 'accepted' : 'rejected'}`, opportunity.is_active ? 'Активна' : 'Скрыта'));
        item.appendChild(top);
        item.appendChild(createEl('div', 'moderation-meta mt-1', `${opportunity.employer_name} | ${opportunity.location}`));
        item.appendChild(createEl('div', 'small mt-1', opportunity.description.length > 120 ? `${opportunity.description.slice(0, 120)}...` : opportunity.description));

        const actions = createEl('div', 'moderation-actions');
        const editBtn = createEl('button', 'btn btn-sm btn-outline-primary', 'Редактировать');
        editBtn.type = 'button';
        editBtn.addEventListener('click', () => openCuratorOpportunityModal(opportunity.id));
        actions.appendChild(editBtn);

        const toggleBtn = createEl(
            'button',
            `btn btn-sm ${opportunity.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`,
            opportunity.is_active ? 'Скрыть карточку' : 'Опубликовать'
        );
        toggleBtn.type = 'button';
        toggleBtn.addEventListener('click', () => {
            void updateCuratorOpportunity(opportunity.id, { is_active: !opportunity.is_active });
        });
        actions.appendChild(toggleBtn);
        item.appendChild(actions);
        opportunitiesContainer.appendChild(item);
    });
}

function getFilteredEmployerResponses() {
    const filters = state.employerResponseFilters;
    return state.employerResponses.filter((response) => {
        if (filters.status && response.status !== filters.status) return false;
        if (filters.search) {
            const combined = `${response.opportunity_title} ${response.applicant_name} ${response.applicant_email} ${response.cover_letter || ''}`;
            if (!includesText(combined, filters.search)) return false;
        }
        return true;
    });
}

function applyEmployerResponseFilters() {
    state.employerResponseFilters.status = el('employerResponseStatusFilter').value;
    state.employerResponseFilters.search = el('employerResponseSearch').value.trim();
    renderEmployerResponses();
}

function resetEmployerResponseFilters() {
    el('employerResponseStatusFilter').value = '';
    el('employerResponseSearch').value = '';
    applyEmployerResponseFilters();
}

function setEmployerRequired(enabled) {
    el('profileCompanyName').required = enabled;
}

function fillApplicantProfile(profile) {
    el('profileFullName').value = profile?.full_name || '';
    el('profileUniversity').value = profile?.university || '';
    el('profileCourse').value = profile?.course_or_year || '';
    el('profileBio').value = profile?.bio || '';
    el('profileSkills').value = profile?.skills || '';
    el('profileExperience').value = profile?.experience || '';
    el('profileGithub').value = profile?.github_url || '';
    el('profilePortfolio').value = profile?.portfolio_url || '';
    el('profilePublic').checked = Boolean(profile?.is_profile_public);
    el('profileShowResponses').checked = Boolean(profile?.show_responses);
}

function fillEmployerProfile(profile) {
    el('profileCompanyName').value = profile?.company_name || '';
    el('profileCompanyDescription').value = profile?.description || '';
    el('profileIndustry').value = profile?.industry || '';
    el('profileWebsite').value = profile?.website || '';
    el('profileSocialLinks').value = profile?.social_links || '';
    el('profileCity').value = profile?.city || '';
    el('profileAddress').value = profile?.address || '';
}

function renderProfileSection() {
    const form = el('profileForm');
    const guestHint = el('profileGuestHint');
    const status = el('profileStatusText');
    const applicantFields = el('applicantProfileFields');
    const employerFields = el('employerProfileFields');

    if (!state.currentUser) {
        form.classList.add('d-none');
        guestHint.classList.remove('d-none');
        status.textContent = 'Гость';
        setEmployerRequired(false);
        return;
    }

    form.classList.remove('d-none');
    guestHint.classList.add('d-none');
    status.textContent = currentRoleLabel(state.currentUser.role);
    el('profileDisplayName').value = state.currentUser.display_name || '';

    if (state.currentUser.role === 'applicant') {
        applicantFields.classList.remove('d-none');
        employerFields.classList.add('d-none');
        setEmployerRequired(false);
        fillApplicantProfile(state.profile?.applicant_profile);
    } else if (state.currentUser.role === 'employer') {
        employerFields.classList.remove('d-none');
        applicantFields.classList.add('d-none');
        setEmployerRequired(true);
        fillEmployerProfile(state.profile?.employer_profile);
    } else {
        applicantFields.classList.add('d-none');
        employerFields.classList.add('d-none');
        setEmployerRequired(false);
    }
}

function openCuratorUserModal(userId) {
    const user = state.curatorUsers.find((item) => item.id === userId);
    if (!user || user.role !== 'employer') return;

    state.pendingCuratorUserId = userId;
    el('curatorEmployerDisplayName').value = user.display_name || '';
    el('curatorEmployerCompanyName').value = user.employer_profile?.company_name || '';
    el('curatorEmployerDescription').value = user.employer_profile?.description || '';
    el('curatorEmployerWebsite').value = user.employer_profile?.website || '';
    el('curatorEmployerCity').value = user.employer_profile?.city || '';
    el('curatorEmployerAddress').value = user.employer_profile?.address || '';
    el('curatorEmployerVerified').checked = Boolean(user.is_verified);
    el('curatorEmployerActive').checked = Boolean(user.is_active);
    curatorUserModal.show();
}

function openCuratorOpportunityModal(opportunityId) {
    const opportunity = state.curatorOpportunities.find((item) => item.id === opportunityId);
    if (!opportunity) return;

    state.pendingCuratorOpportunityId = opportunityId;
    el('curatorOpportunityTitle').value = opportunity.title || '';
    el('curatorOpportunityType').value = opportunity.type || 'job';
    el('curatorOpportunityWorkFormat').value = opportunity.work_format || 'office';
    el('curatorOpportunityLocation').value = opportunity.location || '';
    el('curatorOpportunitySalary').value = opportunity.salary_range || '';
    el('curatorOpportunityExpiresAt').value = toDateTimeLocalValue(opportunity.expires_at);
    el('curatorOpportunityDescription').value = opportunity.description || '';
    el('curatorOpportunityActive').checked = Boolean(opportunity.is_active);
    curatorOpportunityModal.show();
}

function resetEmployerOpportunityForm() {
    state.pendingEmployerOpportunityId = null;
    el('employerOpportunityModalLabel').textContent = 'Новая карточка возможности';
    el('employerOpportunityTitle').value = '';
    el('employerOpportunityType').value = 'job';
    el('employerOpportunityWorkFormat').value = 'office';
    el('employerOpportunityLocation').value = '';
    el('employerOpportunitySalary').value = '';
    el('employerOpportunityExpiresAt').value = '';
    el('employerOpportunityEventDate').value = '';
    el('employerOpportunityDescription').value = '';
    el('employerOpportunityActive').checked = true;
    syncEmployerOpportunityFieldHints();
}

function openEmployerOpportunityModal(opportunityId = null) {
    if (!opportunityId) {
        resetEmployerOpportunityForm();
        const employerProfile = state.profile?.employer_profile;
        const defaultLocation = employerProfile?.address || employerProfile?.city || '';
        if (defaultLocation) {
            el('employerOpportunityLocation').value = defaultLocation;
        }
        employerOpportunityModal.show();
        return;
    }

    const opportunity = state.employerOpportunities.find((item) => item.id === opportunityId);
    if (!opportunity) return;

    state.pendingEmployerOpportunityId = opportunityId;
    el('employerOpportunityModalLabel').textContent = 'Редактирование карточки';
    el('employerOpportunityTitle').value = opportunity.title || '';
    el('employerOpportunityType').value = opportunity.type || 'job';
    el('employerOpportunityWorkFormat').value = opportunity.work_format || 'office';
    el('employerOpportunityLocation').value = opportunity.location || '';
    el('employerOpportunitySalary').value = opportunity.salary_range || '';
    el('employerOpportunityExpiresAt').value = toDateTimeLocalValue(opportunity.expires_at);
    el('employerOpportunityEventDate').value = toDateTimeLocalValue(opportunity.event_date);
    el('employerOpportunityDescription').value = opportunity.description || '';
    el('employerOpportunityActive').checked = Boolean(opportunity.is_active);
    syncEmployerOpportunityFieldHints();
    employerOpportunityModal.show();
}

function syncEmployerOpportunityFieldHints() {
    const type = el('employerOpportunityType').value;
    const workFormat = el('employerOpportunityWorkFormat').value;
    const locationInput = el('employerOpportunityLocation');
    const locationHint = el('employerOpportunityLocationHint');
    const eventDateGroup = el('employerOpportunityEventDateGroup');

    if (type === 'event') {
        eventDateGroup.classList.remove('d-none');
    } else {
        eventDateGroup.classList.add('d-none');
        el('employerOpportunityEventDate').value = '';
    }

    if (workFormat === 'remote') {
        locationInput.placeholder = 'Например: Москва';
        locationHint.textContent = 'Для удаленного формата укажи город работодателя или организатора.';
    } else if (type === 'event') {
        locationInput.placeholder = 'Например: Санкт-Петербург, Кронверкский пр., 49';
        locationHint.textContent = 'Для офлайн-мероприятия лучше указать точный адрес площадки.';
    } else {
        locationInput.placeholder = 'Например: Москва, ул. Льва Толстого, 16';
        locationHint.textContent = 'Укажи адрес офиса, площадки или город работодателя.';
    }
}

function buildEmployerOpportunityPayload() {
    return {
        title: (el('employerOpportunityTitle').value || '').trim(),
        description: (el('employerOpportunityDescription').value || '').trim(),
        type: el('employerOpportunityType').value,
        work_format: el('employerOpportunityWorkFormat').value,
        location: (el('employerOpportunityLocation').value || '').trim(),
        salary_range: normalizeText(el('employerOpportunitySalary').value),
        expires_at: el('employerOpportunityExpiresAt').value ? new Date(el('employerOpportunityExpiresAt').value).toISOString() : null,
        event_date: el('employerOpportunityEventDate').value ? new Date(el('employerOpportunityEventDate').value).toISOString() : null,
        is_active: el('employerOpportunityActive').checked,
        tag_ids: [],
    };
}

async function saveEmployerOpportunity({ id = null, payload, successMessage }) {
    const path = id ? `/opportunities/${id}` : '/opportunities/';
    const method = id ? 'PUT' : 'POST';
    const response = await apiFetch(path, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось сохранить карточку.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось сохранить карточку.');
        return false;
    }

    await Promise.all([
        loadEmployerOpportunities(),
        loadOpportunities(),
        loadEmployerResponses(),
    ]);
    if (successMessage) {
        showNotice('success', successMessage);
    }
    return true;
}

async function deleteEmployerOpportunity(opportunityId) {
    const confirmed = window.confirm('Удалить карточку возможности? Это действие нельзя отменить.');
    if (!confirmed) return;

    const response = await apiFetch(`/opportunities/${opportunityId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось удалить карточку.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось удалить карточку.');
        return;
    }

    await Promise.all([
        loadEmployerOpportunities(),
        loadOpportunities(),
        loadEmployerResponses(),
    ]);
    showNotice('success', 'Карточка удалена.');
}

function buildProfilePayload() {
    const payload = {
        display_name: normalizeText(el('profileDisplayName').value),
    };

    if (!state.currentUser) return payload;

    if (state.currentUser.role === 'applicant') {
        payload.applicant_profile = {
            full_name: normalizeText(el('profileFullName').value),
            university: normalizeText(el('profileUniversity').value),
            course_or_year: normalizeText(el('profileCourse').value),
            bio: normalizeText(el('profileBio').value),
            skills: normalizeText(el('profileSkills').value),
            experience: normalizeText(el('profileExperience').value),
            github_url: normalizeUrl(el('profileGithub').value),
            portfolio_url: normalizeUrl(el('profilePortfolio').value),
            is_profile_public: el('profilePublic').checked,
            show_responses: el('profileShowResponses').checked,
        };
    }

    if (state.currentUser.role === 'employer') {
        payload.employer_profile = {
            company_name: normalizeText(el('profileCompanyName').value),
            description: normalizeText(el('profileCompanyDescription').value),
            industry: normalizeText(el('profileIndustry').value),
            website: normalizeUrl(el('profileWebsite').value),
            social_links: normalizeText(el('profileSocialLinks').value),
            city: normalizeText(el('profileCity').value),
            address: normalizeText(el('profileAddress').value),
        };
    }

    return payload;
}

function renderAuthUI() {
    const loginBtn = el('loginBtn');
    const registerBtn = el('registerBtn');
    const logoutNavItem = el('logoutNavItem');
    const currentUserNavItem = el('currentUserNavItem');
    const currentUserLabel = el('currentUserLabel');
    const authStatusBadge = el('authStatusBadge');

    if (state.currentUser) {
        loginBtn.parentElement.classList.add('d-none');
        registerBtn.parentElement.classList.add('d-none');
        logoutNavItem.classList.remove('d-none');
        currentUserNavItem.classList.remove('d-none');
        currentUserLabel.textContent = `${state.currentUser.display_name} (${currentRoleLabel(state.currentUser.role)})`;
        authStatusBadge.textContent = currentRoleLabel(state.currentUser.role);
        authStatusBadge.className = 'badge text-bg-success';
    } else {
        loginBtn.parentElement.classList.remove('d-none');
        registerBtn.parentElement.classList.remove('d-none');
        logoutNavItem.classList.add('d-none');
        currentUserNavItem.classList.add('d-none');
        currentUserLabel.textContent = '';
        authStatusBadge.textContent = 'Гость';
        authStatusBadge.className = 'badge text-bg-light';
    }

    if (!visibleViews().includes(state.activeView)) {
        state.activeView = 'home';
    }
    renderWorkspaceNav();
    renderWorkspaceView();
}

function renderWorkspaceNav() {
    const tabs = {
        home: el('tabHome'),
        profile: el('tabProfile'),
        applicant: el('tabApplicant'),
        employer: el('tabEmployer'),
        curator: el('tabCurator'),
    };
    const allowedViews = visibleViews();

    Object.entries(tabs).forEach(([view, button]) => {
        if (!button) return;
        button.classList.toggle('d-none', !allowedViews.includes(view));
        button.classList.toggle('btn-primary', state.activeView === view);
        button.classList.toggle('btn-outline-primary', state.activeView !== view);
    });
}

function renderWorkspaceView() {
    const homeMapColumn = el('homeMapColumn');
    const workspaceContentColumn = el('workspaceContentColumn');
    const homeBlocks = [
        'homeListHeader',
        'homeFiltersCard',
        'homeFavoritesCard',
        'opportunities-list',
        'homeDetailsCard',
    ];
    const roleBlocks = {
        profile: ['profileCard'],
        applicant: ['applicantResponsesCard', 'applicantContactsCard'],
        employer: ['employerResponsesCard', 'employerOpportunitiesCard'],
        curator: ['curatorCard'],
    };

    const isHome = state.activeView === 'home';

    homeMapColumn.classList.toggle('d-none', !isHome);
    workspaceContentColumn.classList.toggle('col-md-5', isHome);
    workspaceContentColumn.classList.toggle('col-12', !isHome);
    workspaceContentColumn.classList.toggle('workspace-wide', !isHome);

    homeBlocks.forEach((id) => {
        el(id).classList.toggle('d-none', !isHome);
    });

    Object.values(roleBlocks).flat().forEach((id) => {
        el(id).classList.add('d-none');
    });

    if (!isHome) {
        (roleBlocks[state.activeView] || []).forEach((id) => {
            el(id).classList.remove('d-none');
        });
    }
}

async function loadProfile() {
    if (!state.currentUser) {
        state.profile = null;
        renderProfileSection();
        return;
    }
    const response = await apiFetch('/profiles/me');
    if (!response.ok) {
        state.profile = null;
        renderProfileSection();
        return;
    }
    state.profile = await response.json();
    renderProfileSection();
}

async function loadCurrentUser() {
    const token = getToken();
    if (!token) {
        state.currentUser = null;
        state.responses = [];
        state.contacts = [];
        state.contactSuggestions = [];
        state.recommendations = [];
        state.employerResponses = [];
        state.employerOpportunities = [];
        state.profile = null;
        renderAuthUI();
        renderResponses();
        renderContactsSection();
        renderEmployerResponses();
        renderEmployerOpportunities();
        renderProfileSection();
        renderCuratorSection();
        renderSelectedOpportunity();
        return;
    }

    const response = await apiFetch('/auth/me');
    if (!response.ok) {
        clearToken();
        state.currentUser = null;
        state.responses = [];
        state.contacts = [];
        state.contactSuggestions = [];
        state.recommendations = [];
        state.employerResponses = [];
        state.employerOpportunities = [];
        state.profile = null;
        renderAuthUI();
        renderResponses();
        renderContactsSection();
        renderEmployerResponses();
        renderEmployerOpportunities();
        renderProfileSection();
        renderCuratorSection();
        renderSelectedOpportunity();
        return;
    }

    state.currentUser = await response.json();
    renderAuthUI();
    await loadProfile();
    await loadResponses();
    await loadContacts();
    await loadRecommendations();
    await loadEmployerResponses();
    await loadEmployerOpportunities();
    await loadCuratorData();
    renderSelectedOpportunity();
}

async function loadOpportunities() {
    const response = await fetch(`${API_BASE}/opportunities/`);
    if (!response.ok) {
        throw new Error('Не удалось загрузить возможности');
    }

    state.opportunities = await response.json();
    if (!state.selectedOpportunityId && state.opportunities.length) {
        state.selectedOpportunityId = state.opportunities[0].id;
    }
    renderOpportunitiesSection();
}

async function loadResponses() {
    if (!state.currentUser || state.currentUser.role !== 'applicant') {
        state.responses = [];
        renderResponses();
        return;
    }

    const response = await apiFetch('/responses/my');
    if (!response.ok) {
        state.responses = [];
        renderResponses();
        return;
    }

    state.responses = await response.json();
    renderResponses();
}

async function loadContacts() {
    if (!state.currentUser || state.currentUser.role !== 'applicant') {
        state.contacts = [];
        state.contactSuggestions = [];
        renderContactsSection();
        return;
    }

    const params = new URLSearchParams();
    if (state.contactSearch) {
        params.set('query', state.contactSearch);
    }

    const [contactsResponse, suggestionsResponse] = await Promise.all([
        apiFetch('/contacts/'),
        apiFetch(`/contacts/suggestions${params.toString() ? `?${params.toString()}` : ''}`),
    ]);

    state.contacts = contactsResponse.ok ? await contactsResponse.json() : [];
    state.contactSuggestions = suggestionsResponse.ok ? await suggestionsResponse.json() : [];
    renderContactsSection();
}

async function loadRecommendations() {
    if (!state.currentUser || state.currentUser.role !== 'applicant') {
        state.recommendations = [];
        renderContactsSection();
        return;
    }

    const response = await apiFetch('/recommendations/');
    if (!response.ok) {
        state.recommendations = [];
        renderContactsSection();
        return;
    }

    state.recommendations = await response.json();
    renderContactsSection();
}

async function loadEmployerResponses() {
    if (!state.currentUser || state.currentUser.role !== 'employer') {
        state.employerResponses = [];
        renderEmployerResponses();
        return;
    }

    const response = await apiFetch('/responses/employer');
    if (!response.ok) {
        state.employerResponses = [];
        renderEmployerResponses();
        return;
    }

    state.employerResponses = await response.json();
    renderEmployerResponses();
}

async function loadEmployerOpportunities() {
    if (!state.currentUser || state.currentUser.role !== 'employer') {
        state.employerOpportunities = [];
        renderEmployerOpportunities();
        return;
    }

    const params = new URLSearchParams();
    if (state.employerOpportunityFilters.search) {
        params.set('query', state.employerOpportunityFilters.search);
    }
    if (state.employerOpportunityFilters.type) {
        params.set('type', state.employerOpportunityFilters.type);
    }
    if (state.employerOpportunityFilters.status) {
        params.set('is_active', String(state.employerOpportunityFilters.status === 'active'));
    }

    const response = await apiFetch(`/opportunities/my${params.toString() ? `?${params.toString()}` : ''}`);
    if (!response.ok) {
        state.employerOpportunities = [];
        renderEmployerOpportunities();
        return;
    }

    state.employerOpportunities = await response.json();
    renderEmployerOpportunities();
}

async function loadCuratorData() {
    if (!state.currentUser || !['curator', 'admin'].includes(state.currentUser.role)) {
        state.curatorUsers = [];
        state.curatorOpportunities = [];
        renderCuratorSection();
        return;
    }

    const userParams = new URLSearchParams();
    const opportunitiesParams = new URLSearchParams();

    if (state.curatorFilters.role) {
        userParams.set('role', state.curatorFilters.role);
    }
    if (state.curatorFilters.userSearch) {
        userParams.set('query', state.curatorFilters.userSearch);
    }
    if (state.curatorFilters.opportunitySearch) {
        opportunitiesParams.set('query', state.curatorFilters.opportunitySearch);
    }
    if (state.curatorFilters.opportunityStatus) {
        opportunitiesParams.set('is_active', String(state.curatorFilters.opportunityStatus === 'active'));
    }

    const userPath = `/curator/users${userParams.toString() ? `?${userParams.toString()}` : ''}`;
    const opportunitiesPath = `/curator/opportunities${opportunitiesParams.toString() ? `?${opportunitiesParams.toString()}` : ''}`;

    const [usersResponse, opportunitiesResponse] = await Promise.all([
        apiFetch(userPath),
        apiFetch(opportunitiesPath),
    ]);

    state.curatorUsers = usersResponse.ok ? await usersResponse.json() : [];
    state.curatorOpportunities = opportunitiesResponse.ok ? await opportunitiesResponse.json() : [];
    renderCuratorSection();
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const formData = new URLSearchParams();
    formData.set('username', el('loginEmail').value.trim());
    formData.set('password', el('loginPassword').value);

    const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
    });

    if (!response.ok) {
        showNotice('danger', 'Не удалось войти. Проверь email и пароль.');
        return;
    }

    const data = await response.json();
    setToken(data.access_token);
    loginModal.hide();
    event.target.reset();
    await loadCurrentUser();
}

async function handleRegisterSubmit(event) {
    event.preventDefault();

    const payload = {
        display_name: el('registerName').value.trim(),
        email: el('registerEmail').value.trim(),
        password: el('registerPassword').value,
        role: el('registerRole').value,
    };

    const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось зарегистрироваться.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось зарегистрироваться.');
        return;
    }

    registerModal.hide();
    event.target.reset();
    el('loginEmail').value = payload.email;
    showNotice('success', 'Аккаунт создан. Теперь войди в систему.');
}

async function handleProfileSubmit(event) {
    event.preventDefault();
    if (!state.currentUser) return;

    const payload = buildProfilePayload();
    const response = await apiFetch('/profiles/me', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось сохранить профиль.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось сохранить профиль.');
        return;
    }

    state.profile = await response.json();
    if (payload.display_name) {
        state.currentUser.display_name = payload.display_name;
    }
    renderAuthUI();
    renderProfileSection();
    showNotice('success', 'Профиль сохранен.');
}

function openApplyModal(opportunityId) {
    const opportunity = state.opportunities.find((item) => item.id === opportunityId);
    if (!opportunity) return;

    state.pendingApplyId = opportunityId;
    el('applyOpportunityMeta').textContent = `${opportunity.title} | ${opportunity.location}`;
    el('coverLetter').value = '';
    applyModal.show();
}

async function handleApplySubmit(event) {
    event.preventDefault();

    if (!state.pendingApplyId) return;

    const response = await apiFetch('/responses/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            opportunity_id: state.pendingApplyId,
            cover_letter: el('coverLetter').value.trim() || null,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось отправить отклик.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось отправить отклик.');
        return;
    }

    applyModal.hide();
    event.target.reset();
    await loadResponses();
    showNotice('success', 'Отклик отправлен.');
}

function applyEmployerOpportunityFilters() {
    state.employerOpportunityFilters.status = el('employerOpportunityStatusFilter').value;
    state.employerOpportunityFilters.type = el('employerOpportunityTypeFilter').value;
    state.employerOpportunityFilters.search = el('employerOpportunitySearch').value.trim();
    void loadEmployerOpportunities();
}

function resetEmployerOpportunityFilters() {
    el('employerOpportunityStatusFilter').value = '';
    el('employerOpportunityTypeFilter').value = '';
    el('employerOpportunitySearch').value = '';
    applyEmployerOpportunityFilters();
}

async function handleEmployerOpportunitySubmit(event) {
    event.preventDefault();
    const payload = buildEmployerOpportunityPayload();
    const isEdit = Boolean(state.pendingEmployerOpportunityId);
    const saved = await saveEmployerOpportunity({
        id: state.pendingEmployerOpportunityId,
        payload,
        successMessage: isEdit ? 'Карточка обновлена.' : 'Карточка создана.',
    });

    if (!saved) {
        return;
    }

    employerOpportunityModal.hide();
    event.target.reset();
    resetEmployerOpportunityForm();
}

async function handleCuratorUserSubmit(event) {
    event.preventDefault();
    if (!state.pendingCuratorUserId) return;

    await updateCuratorUser(state.pendingCuratorUserId, {
        display_name: normalizeText(el('curatorEmployerDisplayName').value),
        is_verified: el('curatorEmployerVerified').checked,
        is_active: el('curatorEmployerActive').checked,
        employer_profile: {
            company_name: normalizeText(el('curatorEmployerCompanyName').value),
            description: normalizeText(el('curatorEmployerDescription').value),
            website: normalizeUrl(el('curatorEmployerWebsite').value),
            city: normalizeText(el('curatorEmployerCity').value),
            address: normalizeText(el('curatorEmployerAddress').value),
        },
    });

    curatorUserModal.hide();
}

async function handleCuratorOpportunitySubmit(event) {
    event.preventDefault();
    if (!state.pendingCuratorOpportunityId) return;

    await updateCuratorOpportunity(state.pendingCuratorOpportunityId, {
        title: normalizeText(el('curatorOpportunityTitle').value),
        type: el('curatorOpportunityType').value,
        work_format: el('curatorOpportunityWorkFormat').value,
        location: normalizeText(el('curatorOpportunityLocation').value),
        salary_range: normalizeText(el('curatorOpportunitySalary').value),
        expires_at: el('curatorOpportunityExpiresAt').value ? new Date(el('curatorOpportunityExpiresAt').value).toISOString() : null,
        description: normalizeText(el('curatorOpportunityDescription').value),
        is_active: el('curatorOpportunityActive').checked,
    });

    curatorOpportunityModal.hide();
}

function handleLogout(event) {
    event.preventDefault();
    clearToken();
    state.currentUser = null;
    state.responses = [];
    state.contacts = [];
    state.contactSuggestions = [];
    state.recommendations = [];
    state.employerResponses = [];
    state.employerOpportunities = [];
    state.curatorUsers = [];
    state.curatorOpportunities = [];
    state.pendingCuratorUserId = null;
    state.pendingCuratorOpportunityId = null;
    state.pendingEmployerOpportunityId = null;
    state.profile = null;
    renderAuthUI();
    renderResponses();
    renderContactsSection();
    renderEmployerResponses();
    renderEmployerOpportunities();
    renderCuratorSection();
    renderProfileSection();
    renderSelectedOpportunity();
}

function initModals() {
    loginModal = new window.bootstrap.Modal(el('loginModal'));
    registerModal = new window.bootstrap.Modal(el('registerModal'));
    applyModal = new window.bootstrap.Modal(el('applyModal'));
    recommendModal = new window.bootstrap.Modal(el('recommendModal'));
    curatorUserModal = new window.bootstrap.Modal(el('curatorUserModal'));
    curatorOpportunityModal = new window.bootstrap.Modal(el('curatorOpportunityModal'));
    employerOpportunityModal = new window.bootstrap.Modal(el('employerOpportunityModal'));
}

function bindEvents() {
    document.querySelectorAll('[data-view]').forEach((button) => {
        button.addEventListener('click', () => {
            setActiveView(button.dataset.view);
        });
    });

    el('loginBtn').addEventListener('click', (event) => {
        event.preventDefault();
        loginModal.show();
    });

    el('registerBtn').addEventListener('click', (event) => {
        event.preventDefault();
        registerModal.show();
    });

    el('logoutBtn').addEventListener('click', handleLogout);
    el('loginForm').addEventListener('submit', handleLoginSubmit);
    el('registerForm').addEventListener('submit', handleRegisterSubmit);
    el('profileForm').addEventListener('submit', handleProfileSubmit);
    el('applyForm').addEventListener('submit', handleApplySubmit);
    el('recommendForm').addEventListener('submit', handleRecommendationSubmit);
    el('employerOpportunityForm').addEventListener('submit', handleEmployerOpportunitySubmit);
    el('curatorUserForm').addEventListener('submit', handleCuratorUserSubmit);
    el('curatorOpportunityForm').addEventListener('submit', handleCuratorOpportunitySubmit);
    el('refreshResponsesBtn').addEventListener('click', () => {
        void loadResponses();
    });
    el('refreshContactsBtn').addEventListener('click', () => {
        void loadContacts();
    });
    el('refreshEmployerResponsesBtn').addEventListener('click', () => {
        void loadEmployerResponses();
    });
    el('refreshEmployerOpportunitiesBtn').addEventListener('click', () => {
        void loadEmployerOpportunities();
    });
    el('openEmployerOpportunityCreateBtn').addEventListener('click', () => {
        openEmployerOpportunityModal();
    });
    el('refreshCuratorBtn').addEventListener('click', () => {
        void loadCuratorData();
    });
    el('filterType').addEventListener('change', applyOpportunityFilters);
    el('filterWorkFormat').addEventListener('change', applyOpportunityFilters);
    el('filterLocation').addEventListener('input', applyOpportunityFilters);
    el('filterSearch').addEventListener('input', applyOpportunityFilters);
    el('filterFavorites').addEventListener('change', applyOpportunityFilters);
    el('filterResetBtn').addEventListener('click', resetOpportunityFilters);
    el('employerResponseStatusFilter').addEventListener('change', applyEmployerResponseFilters);
    el('employerResponseSearch').addEventListener('input', applyEmployerResponseFilters);
    el('employerResponseClearBtn').addEventListener('click', resetEmployerResponseFilters);
    el('contactSearchInput').addEventListener('input', () => {
        state.contactSearch = el('contactSearchInput').value.trim();
        void loadContacts();
    });
    el('contactSearchResetBtn').addEventListener('click', () => {
        el('contactSearchInput').value = '';
        state.contactSearch = '';
        void loadContacts();
    });
    el('employerOpportunityStatusFilter').addEventListener('change', applyEmployerOpportunityFilters);
    el('employerOpportunityTypeFilter').addEventListener('change', applyEmployerOpportunityFilters);
    el('employerOpportunitySearch').addEventListener('input', applyEmployerOpportunityFilters);
    el('employerOpportunityClearBtn').addEventListener('click', resetEmployerOpportunityFilters);
    el('employerOpportunityType').addEventListener('change', syncEmployerOpportunityFieldHints);
    el('employerOpportunityWorkFormat').addEventListener('change', syncEmployerOpportunityFieldHints);
    el('curatorUserRoleFilter').addEventListener('change', () => {
        state.curatorFilters.role = el('curatorUserRoleFilter').value;
        void loadCuratorData();
    });
    el('curatorSearch').addEventListener('input', () => {
        state.curatorFilters.userSearch = el('curatorSearch').value.trim();
        void loadCuratorData();
    });
    el('curatorVerificationFilter').addEventListener('change', () => {
        state.curatorFilters.verification = el('curatorVerificationFilter').value;
        renderCuratorSection();
    });
    el('curatorOpportunityStatusFilter').addEventListener('change', () => {
        state.curatorFilters.opportunityStatus = el('curatorOpportunityStatusFilter').value;
        void loadCuratorData();
    });
    el('curatorOpportunitySearch').addEventListener('input', () => {
        state.curatorFilters.opportunitySearch = el('curatorOpportunitySearch').value.trim();
        void loadCuratorData();
    });
}

async function bootstrap() {
    initModals();
    bindEvents();
    loadFavoritesState();
    renderAuthUI();
    renderResponses();
    renderContactsSection();
    renderEmployerResponses();
    renderEmployerOpportunities();
    renderCuratorSection();
    renderProfileSection();
    renderSelectedOpportunity();
    renderFavoritesSummary();
    syncEmployerOpportunityFieldHints();

    try {
        await initMap();
        await loadOpportunities();
        await loadCurrentUser();
    } catch (error) {
        console.error(error);
        renderAlert(el('opportunities-list'), 'danger', 'Не удалось загрузить проект. Проверь API и ключ Яндекс Карт.');
        el('map').innerHTML = '<div class="alert alert-danger m-2">Карта недоступна</div>';
    }
}

void bootstrap();
