import { createEl, el } from './utils.js';

const FIELD_MAX_LENGTHS = {
    loginEmail: 255,
    loginPassword: 255,
    registerName: 100,
    registerEmail: 255,
    registerPassword: 255,
    profileDisplayName: 100,
    profileFullName: 200,
    profileUniversity: 200,
    profileCourse: 50,
    profileGithub: 500,
    profilePortfolio: 500,
    profileCompanyName: 200,
    profileIndustry: 100,
    profileWebsite: 500,
    profileCity: 100,
    profileAddress: 300,
    tagNameInput: 50,
    curatorTagNameInput: 50,
    curatorUserDisplayName: 100,
    curatorApplicantFullName: 200,
    curatorApplicantUniversity: 200,
    curatorApplicantCourse: 50,
    curatorApplicantGithub: 500,
    curatorApplicantPortfolio: 500,
    curatorEmployerCompanyName: 200,
    curatorEmployerIndustry: 100,
    curatorEmployerWebsite: 500,
    curatorEmployerCity: 100,
    curatorEmployerAddress: 300,
    curatorCreateName: 100,
    curatorCreatePassword: 255,
    curatorOpportunityTitle: 200,
    curatorOpportunityLocation: 300,
    curatorOpportunitySalary: 100,
    employerOpportunityTitle: 200,
    employerOpportunityLocation: 300,
    employerOpportunitySalary: 100,
};

const COUNTED_FIELD_LIMITS = {
    profileBio: 500,
    profileSkills: 500,
    profileExperience: 1500,
    profileCompanyDescription: 1500,
    profileSocialLinks: 1000,
    coverLetter: 2000,
    recommendMessage: 500,
    curatorApplicantSkills: 500,
    curatorApplicantExperience: 1500,
    curatorApplicantBio: 500,
    curatorEmployerDescription: 1500,
    curatorEmployerSocialLinks: 1000,
    curatorOpportunityDescription: 3000,
    employerOpportunityDescription: 3000,
};

export function updateFieldCounter(fieldId) {
    const field = el(fieldId);
    const counter = document.querySelector(`[data-counter-for="${fieldId}"]`);
    if (!field || !counter) return;

    const currentLength = field.value.length;
    const maxLength = Number(field.maxLength) || 0;
    counter.textContent = `${currentLength} / ${maxLength}`;
    counter.classList.toggle('near-limit', maxLength > 0 && currentLength >= Math.round(maxLength * 0.9));
}

export function refreshFieldCounters() {
    Object.keys(COUNTED_FIELD_LIMITS).forEach(updateFieldCounter);
}

export function setupFieldLimits() {
    Object.entries(FIELD_MAX_LENGTHS).forEach(([fieldId, maxLength]) => {
        const field = el(fieldId);
        if (field) {
            field.maxLength = maxLength;
        }
    });

    Object.entries(COUNTED_FIELD_LIMITS).forEach(([fieldId, maxLength]) => {
        const field = el(fieldId);
        if (!field) return;

        field.maxLength = maxLength;

        let counter = document.querySelector(`[data-counter-for="${fieldId}"]`);
        if (!counter) {
            counter = createEl('div', 'field-limit-counter text-end');
            counter.dataset.counterFor = fieldId;
            field.insertAdjacentElement('afterend', counter);
        }

        field.addEventListener('input', () => updateFieldCounter(fieldId));
        updateFieldCounter(fieldId);
    });
}
