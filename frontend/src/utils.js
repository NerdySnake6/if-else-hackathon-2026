export function el(id) {
    return document.getElementById(id);
}

export function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function normalizeText(value) {
    const text = (value || '').trim();
    return text || null;
}

export function normalizeUrl(value) {
    const text = (value || '').trim();
    return text || null;
}

export function selectedTagIdsFromContainer(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .tag-choice.active`))
        .map((item) => Number(item.dataset.tagId))
        .filter((value) => Number.isInteger(value));
}

export function toDateTimeLocalValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

export function includesText(haystack, needle) {
    return (haystack || '').toLowerCase().includes((needle || '').toLowerCase());
}

export function tagCategoryLabel(category) {
    if (category === 'tech') return 'Технология';
    if (category === 'level') return 'Уровень';
    if (category === 'employment_type') return 'Занятость';
    if (category === 'format') return 'Формат';
    return category;
}

export function formatDate(dateString) {
    if (!dateString) return 'Без срока';
    return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

export function renderAlert(container, kind, text) {
    container.innerHTML = '';
    container.appendChild(createEl('div', `alert alert-${kind} mb-0`, text));
}

export function showNotice(kind, text) {
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

export function statusLabel(status) {
    if (status === 'accepted') return 'Принят';
    if (status === 'rejected') return 'Отклонен';
    if (status === 'reserve') return 'В резерве';
    return 'На рассмотрении';
}

export function contactStatusLabel(status) {
    if (status === 'accepted') return 'Контакт подтвержден';
    if (status === 'declined') return 'Заявка отклонена';
    return 'Заявка отправлена';
}

export function curatorRoleLabel(role) {
    if (role === 'employer') return 'Работодатель';
    if (role === 'applicant') return 'Соискатель';
    if (role === 'curator') return 'Куратор';
    if (role === 'admin') return 'Администратор';
    return role;
}

export function currentRoleLabel(role) {
    if (role === 'applicant') return 'Соискатель';
    if (role === 'employer') return 'Работодатель';
    if (role === 'curator') return 'Куратор';
    if (role === 'admin') return 'Администратор';
    return role;
}

export function opportunityTypeLabel(type) {
    if (type === 'internship') return 'Стажировка';
    if (type === 'job') return 'Работа';
    if (type === 'mentorship') return 'Менторство';
    if (type === 'event') return 'Событие';
    return type;
}

export function workFormatLabel(workFormat) {
    if (workFormat === 'office') return 'Офис';
    if (workFormat === 'hybrid') return 'Гибрид';
    if (workFormat === 'remote') return 'Удаленно';
    return workFormat;
}

function isValidEmail(email) {
    // Регулярное выражение для проверки формата почты
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}
