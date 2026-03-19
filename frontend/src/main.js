import './style.css';

const API_BASE = '/api';
const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
const TOKEN_KEY = 'tramplin_access_token';

const state = {
    opportunities: [],
    currentUser: null,
    selectedOpportunityId: null,
    pendingApplyId: null,
    pendingCuratorUserId: null,
    pendingCuratorOpportunityId: null,
    responses: [],
    employerResponses: [],
    curatorUsers: [],
    curatorOpportunities: [],
    profile: null,
    opportunityFilters: {
        type: '',
        workFormat: '',
        location: '',
        search: '',
    },
    employerResponseFilters: {
        status: '',
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
let curatorUserModal;
let curatorOpportunityModal;

function el(id) {
    return document.getElementById(id);
}

function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
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

function buildOpportunityPopup(opportunity) {
    const popup = createEl('div', 'opportunity-popup');
    popup.appendChild(createEl('h6', '', opportunity.title));
    popup.appendChild(createEl('div', 'company', opportunity.type));

    if (opportunity.salary_range) {
        popup.appendChild(createEl('div', 'salary', `💰 ${opportunity.salary_range}`));
    }

    const tags = Array.isArray(opportunity.tags) ? opportunity.tags.map((tag) => `#${tag.name}`).join(' ') : '';
    if (tags) {
        popup.appendChild(createEl('div', 'tags', tags));
    }
    popup.appendChild(createEl('small', '', `${opportunity.location} | ${opportunity.work_format}`));
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
        const item = createEl(
            'a',
            `list-group-item list-group-item-action opportunity-item${state.selectedOpportunityId === opportunity.id ? ' active' : ''}`
        );
        item.href = '#';

        const shortDesc = opportunity.description.length > 120
            ? `${opportunity.description.slice(0, 120)}...`
            : opportunity.description;

        const header = createEl('div', 'd-flex w-100 justify-content-between');
        header.appendChild(createEl('h6', 'mb-1', opportunity.title));
        header.appendChild(createEl('small', 'badge bg-secondary', opportunity.type));

        const desc = createEl('p', 'mb-1', shortDesc);
        const meta = createEl('small');
        const icon = createEl('i', 'bi bi-geo-alt');
        meta.appendChild(icon);
        meta.append(` ${opportunity.location} | ${opportunity.work_format}`);
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
        if (filters.search) {
            const tags = Array.isArray(opportunity.tags) ? opportunity.tags.map((tag) => tag.name).join(' ') : '';
            const text = [
                opportunity.title,
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
}

function applyOpportunityFilters() {
    state.opportunityFilters.type = el('filterType').value;
    state.opportunityFilters.workFormat = el('filterWorkFormat').value;
    state.opportunityFilters.location = el('filterLocation').value.trim();
    state.opportunityFilters.search = el('filterSearch').value.trim();
    renderOpportunitiesSection();
}

function resetOpportunityFilters() {
    el('filterType').value = '';
    el('filterWorkFormat').value = '';
    el('filterLocation').value = '';
    el('filterSearch').value = '';
    applyOpportunityFilters();
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
    container.appendChild(createEl('p', 'detail-meta mb-2', `${opportunity.type} | ${opportunity.work_format} | ${opportunity.location}`));
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

    container.appendChild(actionWrap);
}

function statusLabel(status) {
    if (status === 'accepted') return 'Принят';
    if (status === 'rejected') return 'Отклонен';
    if (status === 'reserve') return 'В резерве';
    return 'На рассмотрении';
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
        alert(typeof error.detail === 'string' ? error.detail : 'Не удалось обновить статус.');
        return;
    }

    await loadEmployerResponses();
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
        alert(typeof error.detail === 'string' ? error.detail : 'Не удалось обновить пользователя.');
        return;
    }

    await loadCuratorData();
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
        alert(typeof error.detail === 'string' ? error.detail : 'Не удалось обновить карточку.');
        return;
    }

    await loadCuratorData();
    await loadOpportunities();
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
        currentUserLabel.textContent = `${state.currentUser.display_name} (${state.currentUser.role})`;
        authStatusBadge.textContent = state.currentUser.role;
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
        state.employerResponses = [];
        state.profile = null;
        renderAuthUI();
        renderResponses();
        renderEmployerResponses();
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
        state.employerResponses = [];
        state.profile = null;
        renderAuthUI();
        renderResponses();
        renderEmployerResponses();
        renderProfileSection();
        renderCuratorSection();
        renderSelectedOpportunity();
        return;
    }

    state.currentUser = await response.json();
    renderAuthUI();
    await loadProfile();
    await loadResponses();
    await loadEmployerResponses();
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
        alert('Не удалось войти. Проверь email и пароль.');
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
        alert(typeof error.detail === 'string' ? error.detail : 'Не удалось зарегистрироваться.');
        return;
    }

    registerModal.hide();
    event.target.reset();
    el('loginEmail').value = payload.email;
    alert('Аккаунт создан. Теперь войди в систему.');
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
        alert(typeof error.detail === 'string' ? error.detail : 'Не удалось сохранить профиль.');
        return;
    }

    state.profile = await response.json();
    if (payload.display_name) {
        state.currentUser.display_name = payload.display_name;
    }
    renderAuthUI();
    renderProfileSection();
    alert('Профиль сохранен.');
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
        alert(typeof error.detail === 'string' ? error.detail : 'Не удалось отправить отклик.');
        return;
    }

    applyModal.hide();
    event.target.reset();
    await loadResponses();
    alert('Отклик отправлен.');
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
    state.employerResponses = [];
    state.curatorUsers = [];
    state.curatorOpportunities = [];
    state.pendingCuratorUserId = null;
    state.pendingCuratorOpportunityId = null;
    state.profile = null;
    renderAuthUI();
    renderResponses();
    renderEmployerResponses();
    renderCuratorSection();
    renderProfileSection();
    renderSelectedOpportunity();
}

function initModals() {
    loginModal = new window.bootstrap.Modal(el('loginModal'));
    registerModal = new window.bootstrap.Modal(el('registerModal'));
    applyModal = new window.bootstrap.Modal(el('applyModal'));
    curatorUserModal = new window.bootstrap.Modal(el('curatorUserModal'));
    curatorOpportunityModal = new window.bootstrap.Modal(el('curatorOpportunityModal'));
}

function bindEvents() {
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
    el('curatorUserForm').addEventListener('submit', handleCuratorUserSubmit);
    el('curatorOpportunityForm').addEventListener('submit', handleCuratorOpportunitySubmit);
    el('refreshResponsesBtn').addEventListener('click', () => {
        void loadResponses();
    });
    el('refreshEmployerResponsesBtn').addEventListener('click', () => {
        void loadEmployerResponses();
    });
    el('refreshCuratorBtn').addEventListener('click', () => {
        void loadCuratorData();
    });
    el('filterType').addEventListener('change', applyOpportunityFilters);
    el('filterWorkFormat').addEventListener('change', applyOpportunityFilters);
    el('filterLocation').addEventListener('input', applyOpportunityFilters);
    el('filterSearch').addEventListener('input', applyOpportunityFilters);
    el('filterResetBtn').addEventListener('click', resetOpportunityFilters);
    el('employerResponseStatusFilter').addEventListener('change', applyEmployerResponseFilters);
    el('employerResponseSearch').addEventListener('input', applyEmployerResponseFilters);
    el('employerResponseClearBtn').addEventListener('click', resetEmployerResponseFilters);
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
    renderAuthUI();
    renderResponses();
    renderEmployerResponses();
    renderCuratorSection();
    renderProfileSection();
    renderSelectedOpportunity();

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
