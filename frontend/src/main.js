import './style.css';
import {
    clearToken,
    getToken,
    isFavoriteCompany,
    isFavoriteOpportunity,
    loadFavoritesState,
    setToken,
    state,
    toggleFavoriteCompany,
    toggleFavoriteOpportunity,
} from './state.js';
import {
    contactStatusLabel,
    createEl,
    currentRoleLabel,
    curatorRoleLabel,
    el,
    formatDate,
    includesText,
    normalizeText,
    normalizeUrl,
    opportunityTypeLabel,
    renderAlert,
    selectedTagIdsFromContainer,
    showNotice,
    statusLabel,
    tagCategoryLabel,
    toDateTimeLocalValue,
    workFormatLabel,
} from './utils.js';
import { apiFetch } from './api.js';
import { createMapController, hasCoords } from './map.js';
import { refreshFieldCounters, setupFieldLimits } from './limits.js';
import { createHomeController } from './home.js';
import { createProfileController } from './profile.js';
import { createApplicantController } from './applicant.js';
import { createEmployerController } from './employer.js';
import { createCuratorController } from './curator.js';

const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY;

let loginModal;
let registerModal;
let applyModal;
let recommendModal;
let applicantProfileModal;
let curatorUserModal;
let curatorCreateModal;
let curatorOpportunityModal;
let employerOpportunityModal;
let renderProfileSection;
let buildProfilePayload;
let renderResponses;
let renderContactsSection;
let openRecommendModal;
let handleRecommendationSubmit;
let openApplicantProfileModal;
let openApplyModal;
let handleApplySubmit;
let renderEmployerResponses;
let renderEmployerOpportunities;
let applyEmployerResponseFilters;
let resetEmployerResponseFilters;
let applyEmployerOpportunityFilters;
let resetEmployerOpportunityFilters;
let openEmployerOpportunityModal;
let syncEmployerOpportunityFieldHints;
let handleEmployerOpportunitySubmit;
let renderCuratorSection;
let openCuratorUserModal;
let openCuratorOpportunityModal;
let handleCuratorUserSubmit;
let handleCuratorCreateSubmit;
let handleCuratorOpportunitySubmit;

const mapController = createMapController({
    apiKey: YANDEX_API_KEY,
    state,
    isFavoriteOpportunity,
    isFavoriteCompany,
    createEl,
    opportunityTypeLabel,
    workFormatLabel,
    onSelectOpportunity(opportunityId) {
        state.selectedOpportunityId = opportunityId;
        renderSelectedOpportunity();
        renderOpportunitiesSection();
    },
});
const initMap = mapController.initMap;
const renderMap = mapController.renderMap;
const centerOnOpportunity = mapController.centerOnOpportunity;

const homeController = createHomeController({
    state,
    renderMap,
    centerOnOpportunity,
    renderWorkspaceHero,
    renderContactsSection: (...args) => renderContactsSection(...args),
    openApplyModal: (...args) => openApplyModal(...args),
    openEmployerOpportunityModal: (...args) => openEmployerOpportunityModal(...args),
});
const getFilteredOpportunities = homeController.getFilteredOpportunities;
const renderOpportunitiesSection = homeController.renderOpportunitiesSection;
const applyOpportunityFilters = homeController.applyOpportunityFilters;
const resetOpportunityFilters = homeController.resetOpportunityFilters;
const renderFavoritesSummary = homeController.renderFavoritesSummary;
const renderTagChoices = homeController.renderTagChoices;
const renderTagLibrary = homeController.renderTagLibrary;
const renderSelectedOpportunity = homeController.renderSelectedOpportunity;

const profileController = createProfileController({
    state,
    renderWorkspaceHero,
    refreshFieldCounters,
});
renderProfileSection = profileController.renderProfileSection;
buildProfilePayload = profileController.buildProfilePayload;

const applicantController = createApplicantController({
    state,
    renderWorkspaceHero,
    refreshFieldCounters,
    selectedOpportunity,
    getRecommendModal: () => recommendModal,
    getApplicantProfileModal: () => applicantProfileModal,
    getApplyModal: () => applyModal,
    loadContacts: () => loadContacts(),
    loadRecommendations: () => loadRecommendations(),
    loadResponses: () => loadResponses(),
});
renderResponses = applicantController.renderResponses;
renderContactsSection = applicantController.renderContactsSection;
openRecommendModal = applicantController.openRecommendModal;
handleRecommendationSubmit = applicantController.handleRecommendationSubmit;
openApplicantProfileModal = applicantController.openApplicantProfileModal;
openApplyModal = applicantController.openApplyModal;
handleApplySubmit = applicantController.handleApplySubmit;

const employerController = createEmployerController({
    state,
    renderWorkspaceHero,
    refreshFieldCounters,
    renderTagChoices,
    loadEmployerResponses: () => loadEmployerResponses(),
    loadEmployerOpportunities: () => loadEmployerOpportunities(),
    loadOpportunities: () => loadOpportunities(),
    getEmployerOpportunityModal: () => employerOpportunityModal,
});
renderEmployerResponses = employerController.renderEmployerResponses;
renderEmployerOpportunities = employerController.renderEmployerOpportunities;
applyEmployerResponseFilters = employerController.applyEmployerResponseFilters;
resetEmployerResponseFilters = employerController.resetEmployerResponseFilters;
applyEmployerOpportunityFilters = employerController.applyEmployerOpportunityFilters;
resetEmployerOpportunityFilters = employerController.resetEmployerOpportunityFilters;
openEmployerOpportunityModal = employerController.openEmployerOpportunityModal;
syncEmployerOpportunityFieldHints = employerController.syncEmployerOpportunityFieldHints;
handleEmployerOpportunitySubmit = employerController.handleEmployerOpportunitySubmit;

const curatorController = createCuratorController({
    state,
    renderWorkspaceHero,
    refreshFieldCounters,
    loadCuratorData: () => loadCuratorData(),
    loadOpportunities: () => loadOpportunities(),
    getCuratorUserModal: () => curatorUserModal,
    getCuratorCreateModal: () => curatorCreateModal,
    getCuratorOpportunityModal: () => curatorOpportunityModal,
});
renderCuratorSection = curatorController.renderCuratorSection;
openCuratorUserModal = curatorController.openCuratorUserModal;
openCuratorOpportunityModal = curatorController.openCuratorOpportunityModal;
handleCuratorUserSubmit = curatorController.handleCuratorUserSubmit;
handleCuratorCreateSubmit = curatorController.handleCuratorCreateSubmit;
handleCuratorOpportunitySubmit = curatorController.handleCuratorOpportunitySubmit;

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

function selectedOpportunity() {
    return state.opportunities.find((item) => item.id === state.selectedOpportunityId) || null;
}

function workspaceMetaForView() {
    const filteredOpportunities = getFilteredOpportunities();
    const favoriteCount = state.favoriteOpportunityIds.length + state.favoriteCompanyIds.length;

    if (state.activeView === 'home') {
        const homeTitle = state.currentUser
            ? 'Главная'
            : 'Трамплин для старта в IT';
        const homeDescription = state.currentUser
            ? 'Ищи вакансии, стажировки, менторские программы и карьерные события на карте и в ленте.'
            : 'Найди первую стажировку, вакансию или карьерное событие и сохрани интересные варианты еще до регистрации.';
        return {
            eyebrow: state.currentUser ? `Режим: ${currentRoleLabel(state.currentUser.role)}` : 'Публичная витрина',
            title: homeTitle,
            description: homeDescription,
            pills: [
                `${filteredOpportunities.length} возможностей`,
                `${state.opportunityFilters.tagIds.length} активных тегов`,
                `${favoriteCount} в избранном`,
            ],
        };
    }

    if (state.activeView === 'profile') {
        return {
            eyebrow: 'Личный кабинет',
            title: 'Профиль',
            description: 'Поддерживай профиль в актуальном состоянии: он влияет на то, как тебя видят работодатели, контакты и кураторы.',
            pills: [
                state.currentUser ? currentRoleLabel(state.currentUser.role) : 'Гость',
                state.profile?.applicant_profile?.is_profile_public ? 'Профиль открыт' : 'Профиль скрыт',
                state.profile?.employer_profile?.company_name || state.currentUser?.display_name || 'Без названия',
            ],
        };
    }

    if (state.activeView === 'applicant') {
        const acceptedContacts = state.contacts.filter((item) => item.status === 'accepted').length;
        return {
            eyebrow: 'Кабинет соискателя',
            title: 'Соискатель',
            description: 'Следи за откликами, развивай профессиональные контакты и делись возможностями с людьми из своей сети.',
            pills: [
                `${state.responses.length} откликов`,
                `${acceptedContacts} контактов`,
                `${state.recommendations.length} рекомендаций`,
            ],
        };
    }

    if (state.activeView === 'employer') {
        const activeOpportunities = state.employerOpportunities.filter((item) => item.is_active).length;
        return {
            eyebrow: 'Кабинет работодателя',
            title: 'Работодатель',
            description: 'Управляй карточками возможностей, поддерживай витрину компании в актуальном состоянии и обрабатывай отклики.',
            pills: [
                `${state.employerOpportunities.length} карточек`,
                `${activeOpportunities} активных`,
                `${state.employerResponses.length} откликов`,
            ],
        };
    }

    if (state.activeView === 'curator') {
        const pendingEmployers = state.curatorUsers.filter((user) => user.role === 'employer' && !user.is_verified).length;
        return {
            eyebrow: state.currentUser?.role === 'admin' ? 'Панель администратора' : 'Панель модерации',
            title: 'Куратор',
            description: 'Проверяй работодателей, модерируй карточки возможностей и держи платформу в целостном и безопасном состоянии.',
            pills: [
                `${state.curatorUsers.length} пользователей`,
                `${pendingEmployers} ждут верификации`,
                `${state.curatorOpportunities.length} карточек`,
            ],
        };
    }

    return {
        eyebrow: 'Платформа',
        title: 'Трамплин',
        description: 'Карьерная платформа для студентов, выпускников, работодателей и карьерных центров.',
        pills: [],
    };
}

function renderWorkspaceHero() {
    const meta = workspaceMetaForView();
    el('workspaceEyebrow').textContent = meta.eyebrow;
    el('workspaceTitle').textContent = meta.title;
    el('workspaceDescription').textContent = meta.description;

    const metaContainer = el('workspaceMeta');
    metaContainer.innerHTML = '';
    meta.pills.filter(Boolean).forEach((pill) => {
        metaContainer.appendChild(createEl('span', 'workspace-pill', pill));
    });

    const heroActions = el('workspaceHeroActions');
    const exploreBtn = el('heroExploreBtn');
    const registerBtn = el('heroRegisterBtn');
    const loginBtn = el('heroLoginBtn');

    if (!heroActions || !exploreBtn || !registerBtn || !loginBtn) return;

    const isHome = state.activeView === 'home';
    const isGuest = !state.currentUser;
    heroActions.classList.toggle('d-none', !isHome);
    registerBtn.classList.toggle('d-none', !isGuest);
    loginBtn.classList.toggle('d-none', !isGuest);

    if (isGuest) {
        exploreBtn.textContent = 'Смотреть возможности';
        exploreBtn.className = 'btn btn-primary btn-sm';
        registerBtn.className = 'btn btn-outline-primary btn-sm';
    } else if (state.currentUser.role === 'applicant') {
        exploreBtn.textContent = 'Перейти к карте';
        exploreBtn.className = 'btn btn-primary btn-sm';
    } else if (state.currentUser.role === 'employer') {
        exploreBtn.textContent = 'Открыть витрину';
        exploreBtn.className = 'btn btn-primary btn-sm';
    } else {
        exploreBtn.textContent = 'Посмотреть платформу';
        exploreBtn.className = 'btn btn-primary btn-sm';
    }
}

async function submitTagForm(nameInputId, categoryInputId, formElement) {
    const response = await apiFetch('/tags/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: (el(nameInputId).value || '').trim(),
            category: el(categoryInputId).value,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Не удалось добавить тег.' }));
        showNotice('danger', typeof error.detail === 'string' ? error.detail : 'Не удалось добавить тег.');
        return;
    }

    formElement.reset();
    await loadTags();
    showNotice('success', 'Тег добавлен в справочник.');
}

async function handleTagSubmit(event) {
    event.preventDefault();
    await submitTagForm('tagNameInput', 'tagCategoryInput', event.target);
}

async function handleCuratorTagSubmit(event) {
    event.preventDefault();
    await submitTagForm('curatorTagNameInput', 'curatorTagCategoryInput', event.target);
}

function renderAuthUI() {
    const loginBtn = el('loginBtn');
    const registerBtn = el('registerBtn');
    const logoutNavItem = el('logoutNavItem');
    const currentUserNavItem = el('currentUserNavItem');
    const currentUserLabel = el('currentUserLabel');
    const authStatusBadge = el('authStatusBadge');
    const guestGuideCard = el('guestGuideCard');
    const curatorTab = el('tabCurator');

    if (state.currentUser) {
        loginBtn.parentElement.classList.add('d-none');
        registerBtn.parentElement.classList.add('d-none');
        logoutNavItem.classList.remove('d-none');
        currentUserNavItem.classList.remove('d-none');
        currentUserLabel.textContent = `${state.currentUser.display_name} (${currentRoleLabel(state.currentUser.role)})`;
        authStatusBadge.textContent = currentRoleLabel(state.currentUser.role);
        authStatusBadge.className = 'badge text-bg-success';
        guestGuideCard?.classList.add('d-none');
    } else {
        loginBtn.parentElement.classList.remove('d-none');
        registerBtn.parentElement.classList.remove('d-none');
        logoutNavItem.classList.add('d-none');
        currentUserNavItem.classList.add('d-none');
        currentUserLabel.textContent = '';
        authStatusBadge.textContent = 'Гостевой режим';
        authStatusBadge.className = 'badge text-bg-warning text-dark';
        guestGuideCard?.classList.remove('d-none');
    }

    if (curatorTab) {
        curatorTab.textContent = state.currentUser?.role === 'admin' ? 'Админ' : 'Куратор';
    }

    if (!visibleViews().includes(state.activeView)) {
        state.activeView = 'home';
    }
    renderWorkspaceNav();
    renderWorkspaceView();
    renderWorkspaceHero();
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
    renderWorkspaceHero();
}

function renderWorkspaceView() {
    const homeMapColumn = el('homeMapColumn');
    const workspaceContentColumn = el('workspaceContentColumn');
    const homeBlocks = [
        'homeExplorerCard',
        'homeDetailsCard',
        'homeBoardRow',
        'homeListHeader',
        'guestGuideCard',
        'homeFiltersCard',
        'homeOpportunityBlock',
        'homeFavoritesCard',
        'opportunities-list',
    ];
    const roleBlocks = {
        profile: ['profileCard'],
        applicant: ['applicantResponsesCard', 'applicantContactsCard'],
        employer: ['employerResponsesCard', 'employerOpportunitiesCard'],
        curator: ['curatorCard'],
    };

    const isHome = state.activeView === 'home';
    const isCuratorWorkspace = state.activeView === 'curator';
    const showMapColumn = isHome || isCuratorWorkspace;
    const useSplitLayout = isHome || isCuratorWorkspace;

    homeMapColumn.classList.toggle('d-none', !showMapColumn);
    workspaceContentColumn.classList.toggle('col-md-5', useSplitLayout);
    workspaceContentColumn.classList.toggle('col-12', !useSplitLayout);
    workspaceContentColumn.classList.toggle('workspace-wide', !useSplitLayout);

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

    renderWorkspaceHero();
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
    const response = await apiFetch('/opportunities/');
    if (!response.ok) {
        throw new Error('Не удалось загрузить возможности');
    }

    state.opportunities = await response.json();
    if (!state.selectedOpportunityId && state.opportunities.length) {
        state.selectedOpportunityId = state.opportunities[0].id;
    }
    renderOpportunitiesSection();
}

async function loadTags() {
    const response = await apiFetch('/tags/');
    if (!response.ok) {
        state.tags = [];
        renderTagChoices('filterTagOptions', []);
        renderTagChoices('employerOpportunityTagOptions', []);
        renderTagLibrary();
        return;
    }

    state.tags = await response.json();
    renderTagChoices('filterTagOptions', state.opportunityFilters.tagIds);
    renderTagChoices('employerOpportunityTagOptions', selectedTagIdsFromContainer('employerOpportunityTagOptions'));
    renderTagLibrary();
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

    const response = await apiFetch('/auth/login', {
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

    const response = await apiFetch('/auth/register', {
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
    state.pendingCuratorUserRole = null;
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
    applicantProfileModal = new window.bootstrap.Modal(el('applicantProfileModal'));
    curatorUserModal = new window.bootstrap.Modal(el('curatorUserModal'));
    curatorCreateModal = new window.bootstrap.Modal(el('curatorCreateModal'));
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

    el('heroExploreBtn').addEventListener('click', () => {
        if (state.activeView !== 'home') {
            setActiveView('home');
        }
        el('homeExplorerCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    el('heroRegisterBtn').addEventListener('click', (event) => {
        event.preventDefault();
        registerModal.show();
    });
    el('heroLoginBtn').addEventListener('click', (event) => {
        event.preventDefault();
        loginModal.show();
    });
    el('guestGuideExploreBtn').addEventListener('click', () => {
        el('homeMapColumn')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    el('guestGuideRegisterBtn').addEventListener('click', (event) => {
        event.preventDefault();
        registerModal.show();
    });

    el('logoutBtn').addEventListener('click', handleLogout);
    el('loginForm').addEventListener('submit', handleLoginSubmit);
    el('registerForm').addEventListener('submit', handleRegisterSubmit);
    el('profileForm').addEventListener('submit', handleProfileSubmit);
    el('applyForm').addEventListener('submit', handleApplySubmit);
    el('recommendForm').addEventListener('submit', handleRecommendationSubmit);
    el('tagForm').addEventListener('submit', handleTagSubmit);
    el('curatorTagForm').addEventListener('submit', handleCuratorTagSubmit);
    el('employerOpportunityForm').addEventListener('submit', handleEmployerOpportunitySubmit);
    el('curatorUserForm').addEventListener('submit', handleCuratorUserSubmit);
    el('curatorCreateForm').addEventListener('submit', handleCuratorCreateSubmit);
    el('curatorOpportunityForm').addEventListener('submit', handleCuratorOpportunitySubmit);
    el('openCuratorCreateBtn').addEventListener('click', () => {
        el('curatorCreateForm').reset();
        curatorCreateModal.show();
    });
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
    setupFieldLimits();
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
    renderTagLibrary();
    syncEmployerOpportunityFieldHints();
    refreshFieldCounters();

    try {
        await initMap();
        await loadTags();
        await loadOpportunities();
        await loadCurrentUser();
    } catch (error) {
        console.error(error);
        renderAlert(el('opportunities-list'), 'danger', 'Не удалось загрузить проект. Проверь API и ключ Яндекс Карт.');
        el('map').innerHTML = '<div class="alert alert-danger m-2">Карта недоступна</div>';
    }
}

void bootstrap();
