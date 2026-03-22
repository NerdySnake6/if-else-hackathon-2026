import {
    isFavoriteCompany,
    isFavoriteOpportunity,
    toggleFavoriteCompany,
    toggleFavoriteOpportunity,
} from './state.js';
import {
    createEl,
    el,
    formatDate,
    includesText,
    opportunityTypeLabel,
    selectedTagIdsFromContainer,
    tagCategoryLabel,
    workFormatLabel,
} from './utils.js';
import { hasCoords } from './map.js';

export function createHomeController({
    state,
    renderMap,
    centerOnOpportunity,
    renderWorkspaceHero,
    renderContactsSection,
    openApplyModal,
    openEmployerOpportunityModal,
}) {
    function selectedOpportunity() {
        return state.opportunities.find((item) => item.id === state.selectedOpportunityId) || null;
    }

    function hasActiveOpportunityFilters() {
        return Boolean(
            state.opportunityFilters.type
            || state.opportunityFilters.workFormat
            || state.opportunityFilters.location
            || state.opportunityFilters.search
            || state.opportunityFilters.favorites
            || state.opportunityFilters.tagIds.length
        );
    }

    function renderList(opportunities) {
        const list = el('opportunities-list');
        const count = el('homeOpportunityCount');
        list.innerHTML = '';
        if (count) {
            count.textContent = `${opportunities.length} ${opportunities.length === 1 ? 'результат' : opportunities.length < 5 ? 'результата' : 'результатов'}`;
        }

        if (!opportunities.length) {
            const panel = createEl('div', 'empty-state-panel');
            panel.appendChild(createEl('div', 'empty-state-icon', '✦'));
            panel.appendChild(createEl('div', 'fw-semibold', hasActiveOpportunityFilters() ? 'По текущим фильтрам ничего не найдено' : 'Пока нет опубликованных возможностей'));
            panel.appendChild(
                createEl(
                    'div',
                    'text-muted small',
                    hasActiveOpportunityFilters()
                        ? 'Попробуй убрать часть фильтров или выбрать другие теги, чтобы расширить поиск.'
                        : 'Когда работодатели и организаторы добавят карточки, они появятся здесь и на карте.'
                )
            );
            if (hasActiveOpportunityFilters()) {
                const resetBtn = createEl('button', 'btn btn-sm btn-outline-primary', 'Сбросить фильтры');
                resetBtn.type = 'button';
                resetBtn.addEventListener('click', resetOpportunityFilters);
                panel.appendChild(resetBtn);
            } else {
                panel.appendChild(createEl('div', 'small text-muted', 'Начать можно с регистрации или изучения карты.'));
            }
            list.appendChild(panel);
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
            if (filters.tagIds.length) {
                const opportunityTagIds = Array.isArray(opportunity.tags) ? opportunity.tags.map((tag) => tag.id) : [];
                if (!filters.tagIds.every((tagId) => opportunityTagIds.includes(tagId))) return false;
            }
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
        if (!selectedStillVisible && state.activeView !== 'home') {
            state.selectedOpportunityId = filteredOpportunities[0].id;
        } else if (!selectedStillVisible) {
            state.selectedOpportunityId = null;
        }
    }

    function renderOpportunitiesSection() {
        const filtered = getFilteredOpportunities();
        syncSelectedOpportunity(filtered);
        renderList(filtered);
        renderSelectedOpportunity();
        renderMap(filtered);
        renderFavoritesSummary();
        renderWorkspaceHero();
    }

    function applyOpportunityFilters() {
        state.opportunityFilters.type = el('filterType').value;
        state.opportunityFilters.workFormat = el('filterWorkFormat').value;
        state.opportunityFilters.location = el('filterLocation').value.trim();
        state.opportunityFilters.search = el('filterSearch').value.trim();
        state.opportunityFilters.favorites = el('filterFavorites').value;
        state.opportunityFilters.tagIds = selectedTagIdsFromContainer('filterTagOptions');
        renderOpportunitiesSection();
    }

    function resetOpportunityFilters() {
        el('filterType').value = '';
        el('filterWorkFormat').value = '';
        el('filterLocation').value = '';
        el('filterSearch').value = '';
        el('filterFavorites').value = '';
        state.opportunityFilters.tagIds = [];
        renderTagChoices('filterTagOptions', []);
        applyOpportunityFilters();
    }

    function renderFavoritesSummary() {
        const container = el('favorites-summary');
        const badge = el('favoriteSummaryBadge');
        container.innerHTML = '';

        const favoriteOpportunities = state.opportunities.filter((item) => isFavoriteOpportunity(item.id));
        const favoriteCompanies = state.favoriteCompanyIds
            .map((companyId) => {
                const currentOpportunity = state.opportunities.find((item) => item.employer_id === companyId) || null;
                return {
                    companyId,
                    companyName: currentOpportunity?.employer_name || state.favoriteCompanyNames[String(companyId)] || 'Компания',
                    currentOpportunity,
                };
            });

        badge.textContent = String(favoriteOpportunities.length + favoriteCompanies.length);

        if (!favoriteOpportunities.length && !favoriteCompanies.length) {
            container.appendChild(createEl('p', 'text-muted mb-0', 'Пока ничего не добавлено в избранное.'));
            return;
        }

        favoriteCompanies.forEach((company) => {
            const chip = createEl('button', 'favorite-chip company', company.companyName);
            chip.type = 'button';
            chip.addEventListener('click', () => {
                el('filterFavorites').value = 'companies';
                state.opportunityFilters.favorites = 'companies';
                if (company.currentOpportunity) {
                    state.selectedOpportunityId = company.currentOpportunity.id;
                }
                renderOpportunitiesSection();
                if (company.currentOpportunity) {
                    centerOnOpportunity(company.currentOpportunity);
                }
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

    function renderTagChoices(containerId, selectedIds = [], { toggleable = true } = {}) {
        const container = el(containerId);
        if (!container) return;
        container.innerHTML = '';

        if (!state.tags.length) {
            container.appendChild(createEl('span', 'text-muted small', 'Теги пока не загружены.'));
            return;
        }

        state.tags.forEach((tag) => {
            const button = createEl('button', `tag-choice${selectedIds.includes(tag.id) ? ' active' : ''}`, tag.name);
            button.type = 'button';
            button.dataset.tagId = String(tag.id);
            button.title = tagCategoryLabel(tag.category);
            if (toggleable) {
                button.addEventListener('click', () => {
                    button.classList.toggle('active');
                    if (containerId === 'filterTagOptions') {
                        state.opportunityFilters.tagIds = selectedTagIdsFromContainer('filterTagOptions');
                        renderOpportunitiesSection();
                    }
                });
            }
            container.appendChild(button);
        });
    }

    function renderTagLibrary() {
        ['tag-library', 'curator-tag-library'].forEach((containerId) => {
            const container = el(containerId);
            if (!container) return;
            container.innerHTML = '';
            if (!state.tags.length) {
                container.appendChild(createEl('p', 'text-muted mb-0', 'Теги пока не загружены.'));
                return;
            }

            state.tags.forEach((tag) => {
                const item = createEl('span', 'tag-library-item');
                item.textContent = tag.name;
                item.appendChild(createEl('small', 'ms-2', tagCategoryLabel(tag.category)));
                container.appendChild(item);
            });
        });
    }

    function renderSelectedOpportunity() {
        const container = el('opportunity-details');
        const detailsCard = el('homeDetailsCard');
        const opportunity = selectedOpportunity();
        container.innerHTML = '';

        if (!opportunity) {
            detailsCard.classList.add('d-none');
            container.appendChild(createEl('h5', 'card-title', 'Выбери возможность'));
            container.appendChild(createEl('p', 'text-muted mb-0', 'Здесь появятся детали вакансии и кнопка отклика.'));
            return;
        }

        detailsCard.classList.remove('d-none');
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

        const actionWrap = createEl('div', 'd-flex flex-wrap gap-2 align-items-center detail-actions');

        const favoriteOpportunityBtn = createEl(
            'button',
            isFavoriteOpportunity(opportunity.id) ? 'btn btn-danger' : 'btn btn-outline-danger',
            isFavoriteOpportunity(opportunity.id) ? 'Убрать вакансию из избранного' : 'В избранное: вакансия'
        );
        favoriteOpportunityBtn.type = 'button';
        favoriteOpportunityBtn.addEventListener('click', () => {
            toggleFavoriteOpportunity(opportunity.id);
            renderOpportunitiesSection();
        });
        actionWrap.appendChild(favoriteOpportunityBtn);

        const favoriteCompanyBtn = createEl(
            'button',
            isFavoriteCompany(opportunity.employer_id) ? 'btn btn-warning' : 'btn btn-outline-warning',
            isFavoriteCompany(opportunity.employer_id) ? 'Убрать компанию из избранного' : 'В избранное: компания'
        );
        favoriteCompanyBtn.type = 'button';
        favoriteCompanyBtn.addEventListener('click', () => {
            toggleFavoriteCompany(opportunity.employer_id, opportunity.employer_name);
            renderOpportunitiesSection();
        });
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

    return {
        getFilteredOpportunities,
        renderOpportunitiesSection,
        applyOpportunityFilters,
        resetOpportunityFilters,
        renderFavoritesSummary,
        renderTagChoices,
        renderTagLibrary,
        renderSelectedOpportunity,
    };
}
