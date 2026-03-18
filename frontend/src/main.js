import './style.css';

const API_BASE = '/api';
const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
const TOKEN_KEY = 'tramplin_access_token';

const state = {
    opportunities: [],
    currentUser: null,
    selectedOpportunityId: null,
    pendingApplyId: null,
    responses: [],
    employerResponses: [],
    profile: null,
};

let map;
let ymapsReadyPromise;
let placemarks = [];
let loginModal;
let registerModal;
let applyModal;

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
            renderList(state.opportunities);
            renderMap(state.opportunities);
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
            renderList(state.opportunities);
            centerOnOpportunity(opportunity);
            renderMap(state.opportunities);
        });

        list.appendChild(item);
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

    if (!state.employerResponses.length) {
        container.appendChild(createEl('p', 'text-muted mb-0', 'Пока нет входящих откликов.'));
        return;
    }

    state.employerResponses.forEach((response) => {
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
    status.textContent = state.currentUser.role === 'applicant' ? 'Соискатель' : 'Работодатель';
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
        renderSelectedOpportunity();
        return;
    }

    state.currentUser = await response.json();
    renderAuthUI();
    await loadProfile();
    await loadResponses();
    await loadEmployerResponses();
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
    renderList(state.opportunities);
    renderSelectedOpportunity();
    renderMap(state.opportunities);
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

function handleLogout(event) {
    event.preventDefault();
    clearToken();
    state.currentUser = null;
    state.responses = [];
    state.employerResponses = [];
    state.profile = null;
    renderAuthUI();
    renderResponses();
    renderEmployerResponses();
    renderProfileSection();
    renderSelectedOpportunity();
}

function initModals() {
    loginModal = new window.bootstrap.Modal(el('loginModal'));
    registerModal = new window.bootstrap.Modal(el('registerModal'));
    applyModal = new window.bootstrap.Modal(el('applyModal'));
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
    el('refreshResponsesBtn').addEventListener('click', () => {
        void loadResponses();
    });
    el('refreshEmployerResponsesBtn').addEventListener('click', () => {
        void loadEmployerResponses();
    });
}

async function bootstrap() {
    initModals();
    bindEvents();
    renderAuthUI();
    renderResponses();
    renderEmployerResponses();
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
