"""Интеграционные тесты для основных пользовательских сценариев."""

from datetime import datetime, timedelta

from app import models
from app.auth import create_access_token


def register_user(client, *, email, password, display_name, role):
    """Регистрирует пользователя через API и возвращает ответ."""
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": display_name,
            "role": role,
        },
    )


def login_user(client, *, email, password):
    """Выполняет вход и возвращает access token."""
    response = client.post(
        "/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_headers(token):
    """Формирует HTTP-заголовки с bearer token."""
    return {"Authorization": f"Bearer {token}"}


def test_public_endpoints_and_public_opportunities(client, db_session):
    """Проверяет публичные маршруты и фильтрацию возможностей."""
    root_response = client.get("/")
    assert root_response.status_code == 200
    assert root_response.json()["message"] == "Трамплин API работает!"

    health_response = client.get("/health")
    assert health_response.status_code == 200
    assert health_response.json() == {"status": "ok"}

    employer = models.User(
        email="employer-public@example.com",
        hashed_password="hash",
        display_name="Public employer",
        role="employer",
        is_active=True,
        is_verified=True,
    )
    db_session.add(employer)
    db_session.commit()
    db_session.refresh(employer)

    active_opp = models.Opportunity(
        employer_id=employer.id,
        title="Python Internship",
        description="Стажировка по backend-разработке для начинающих специалистов.",
        type="internship",
        work_format="office",
        location="Москва",
        is_active=True,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    inactive_opp = models.Opportunity(
        employer_id=employer.id,
        title="Hidden vacancy",
        description="Эта вакансия не должна попадать в публичный список возможностей.",
        type="job",
        work_format="remote",
        location="Санкт-Петербург",
        is_active=False,
    )
    expired_opp = models.Opportunity(
        employer_id=employer.id,
        title="Expired event",
        description="Это мероприятие уже завершилось и не должно быть видно публично.",
        type="event",
        work_format="office",
        location="Казань",
        is_active=True,
        expires_at=datetime.utcnow() - timedelta(days=1),
    )

    db_session.add_all([active_opp, inactive_opp, expired_opp])
    db_session.commit()

    opportunities_response = client.get("/opportunities/")
    assert opportunities_response.status_code == 200

    payload = opportunities_response.json()
    assert len(payload) == 1
    assert payload[0]["title"] == "Python Internship"
    assert payload[0]["employer_name"] == "Public employer"


def test_auth_and_profile_flow(client):
    """Проверяет регистрацию, вход и обновление профиля соискателя."""
    register_response = register_user(
        client,
        email="student@example.com",
        password="supersecret",
        display_name="Student One",
        role="applicant",
    )
    assert register_response.status_code == 200

    token = login_user(
        client,
        email="student@example.com",
        password="supersecret",
    )

    me_response = client.get("/auth/me", headers=auth_headers(token))
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "student@example.com"

    update_response = client.put(
        "/profiles/me",
        headers=auth_headers(token),
        json={
            "display_name": "Student Updated",
            "applicant_profile": {
                "full_name": "Иван Студентов",
                "university": "ИТМО",
                "course_or_year": "4 курс",
                "is_profile_public": True,
            },
        },
    )
    assert update_response.status_code == 200

    profile_response = client.get("/profiles/me", headers=auth_headers(token))
    assert profile_response.status_code == 200
    profile = profile_response.json()
    assert profile["display_name"] == "Student Updated"
    assert profile["applicant_profile"]["full_name"] == "Иван Студентов"
    assert profile["applicant_profile"]["is_profile_public"] is True


def test_employer_opportunity_and_response_flow(client, db_session):
    """Проверяет создание возможности, отклик и смену статуса работодателем."""
    employer_register = register_user(
        client,
        email="employer@example.com",
        password="supersecret",
        display_name="Employer",
        role="employer",
    )
    assert employer_register.status_code == 200

    employer = (
        db_session.query(models.User)
        .filter(models.User.email == "employer@example.com")
        .first()
    )
    employer.is_verified = True
    db_session.commit()

    employer_token = login_user(
        client,
        email="employer@example.com",
        password="supersecret",
    )

    create_opportunity_response = client.post(
        "/opportunities/",
        headers=auth_headers(employer_token),
        json={
            "title": "Junior Backend Intern",
            "description": "Стажировка по Python и FastAPI с наставничеством и реальными задачами.",
            "type": "internship",
            "work_format": "remote",
            "location": "Москва",
            "salary_range": "до 80 000",
            "tag_ids": [],
        },
    )
    assert create_opportunity_response.status_code == 200
    opportunity_id = create_opportunity_response.json()["id"]

    applicant_register = register_user(
        client,
        email="applicant@example.com",
        password="supersecret",
        display_name="Applicant",
        role="applicant",
    )
    assert applicant_register.status_code == 200

    applicant_token = login_user(
        client,
        email="applicant@example.com",
        password="supersecret",
    )

    create_response_result = client.post(
        "/responses/",
        headers=auth_headers(applicant_token),
        json={
            "opportunity_id": opportunity_id,
            "cover_letter": "Хочу попасть на стажировку и готов выполнить тестовое задание.",
        },
    )
    assert create_response_result.status_code == 201
    response_id = create_response_result.json()["id"]

    my_responses = client.get("/responses/my", headers=auth_headers(applicant_token))
    assert my_responses.status_code == 200
    assert len(my_responses.json()) == 1

    employer_responses = client.get(
        "/responses/employer",
        headers=auth_headers(employer_token),
    )
    assert employer_responses.status_code == 200
    assert len(employer_responses.json()) == 1
    assert employer_responses.json()[0]["opportunity_id"] == opportunity_id

    update_status = client.patch(
        f"/responses/{response_id}/status",
        headers=auth_headers(employer_token),
        json={"status": "accepted"},
    )
    assert update_status.status_code == 200
    assert update_status.json()["status"] == "accepted"


def test_employer_can_manage_own_opportunities(client, db_session):
    """Проверяет создание, просмотр, редактирование и удаление своих карточек работодателем."""
    register_response = register_user(
        client,
        email="owner@example.com",
        password="supersecret",
        display_name="Owner Employer",
        role="employer",
    )
    assert register_response.status_code == 200

    employer = (
        db_session.query(models.User)
        .filter(models.User.email == "owner@example.com")
        .first()
    )
    employer.is_verified = True
    db_session.commit()

    token = login_user(
        client,
        email="owner@example.com",
        password="supersecret",
    )
    headers = auth_headers(token)

    create_response = client.post(
        "/opportunities/",
        headers=headers,
        json={
            "title": "Junior Python Developer",
            "description": "Полноценная стартовая позиция для начинающего backend-разработчика с наставничеством.",
            "type": "job",
            "work_format": "office",
            "location": "Москва, ул. Льва Толстого, 16",
            "salary_range": "80 000 - 120 000",
            "expires_at": (datetime.utcnow() + timedelta(days=14)).isoformat(),
            "tag_ids": [],
        },
    )
    assert create_response.status_code == 200
    opportunity_id = create_response.json()["id"]

    my_response = client.get("/opportunities/my", headers=headers)
    assert my_response.status_code == 200
    assert len(my_response.json()) == 1
    assert my_response.json()[0]["title"] == "Junior Python Developer"

    filtered_response = client.get("/opportunities/my?query=Python", headers=headers)
    assert filtered_response.status_code == 200
    assert len(filtered_response.json()) == 1

    update_response = client.put(
        f"/opportunities/{opportunity_id}",
        headers=headers,
        json={
            "title": "Junior Python Developer Updated",
            "description": "Обновленная карточка с уточненным стеком, условиями работы и расширенным описанием задач.",
            "type": "job",
            "work_format": "hybrid",
            "location": "Санкт-Петербург",
            "salary_range": "до 140 000",
            "is_active": False,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Junior Python Developer Updated"
    assert update_response.json()["work_format"] == "hybrid"
    assert update_response.json()["is_active"] is False

    archived_response = client.get("/opportunities/my?is_active=false", headers=headers)
    assert archived_response.status_code == 200
    assert len(archived_response.json()) == 1
    assert archived_response.json()[0]["id"] == opportunity_id

    delete_response = client.delete(f"/opportunities/{opportunity_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json() == {"ok": True}

    empty_response = client.get("/opportunities/my", headers=headers)
    assert empty_response.status_code == 200
    assert empty_response.json() == []


def test_applicants_can_build_network_contacts(client):
    """Проверяет поиск открытых профилей, заявку в контакты и подтверждение связи."""
    first_user = register_user(
        client,
        email="network-one@example.com",
        password="supersecret",
        display_name="Network One",
        role="applicant",
    )
    second_user = register_user(
        client,
        email="network-two@example.com",
        password="supersecret",
        display_name="Network Two",
        role="applicant",
    )
    assert first_user.status_code == 200
    assert second_user.status_code == 200

    first_token = login_user(
        client,
        email="network-one@example.com",
        password="supersecret",
    )
    second_token = login_user(
        client,
        email="network-two@example.com",
        password="supersecret",
    )

    first_profile_response = client.put(
        "/profiles/me",
        headers=auth_headers(first_token),
        json={
            "display_name": "Network One Updated",
            "applicant_profile": {
                "full_name": "Иван Нетворкинг",
                "university": "ИТМО",
                "skills": "Python, FastAPI",
                "is_profile_public": True,
            },
        },
    )
    assert first_profile_response.status_code == 200

    second_profile_response = client.put(
        "/profiles/me",
        headers=auth_headers(second_token),
        json={
            "display_name": "Network Two Updated",
            "applicant_profile": {
                "full_name": "Мария Контакт",
                "university": "СПбГУ",
                "skills": "React, TypeScript",
                "is_profile_public": True,
            },
        },
    )
    assert second_profile_response.status_code == 200

    suggestions_response = client.get("/contacts/suggestions", headers=auth_headers(first_token))
    assert suggestions_response.status_code == 200
    suggestions = suggestions_response.json()
    assert len(suggestions) == 1
    assert suggestions[0]["display_name"] == "Network Two Updated"

    create_contact_response = client.post(
        "/contacts/",
        headers=auth_headers(first_token),
        json={"addressee_id": suggestions[0]["id"]},
    )
    assert create_contact_response.status_code == 201
    contact_id = create_contact_response.json()["id"]

    outgoing_contacts = client.get("/contacts/", headers=auth_headers(first_token))
    assert outgoing_contacts.status_code == 200
    assert outgoing_contacts.json()[0]["direction"] == "outgoing"
    assert outgoing_contacts.json()[0]["peer"]["display_name"] == "Network Two Updated"

    incoming_contacts = client.get("/contacts/", headers=auth_headers(second_token))
    assert incoming_contacts.status_code == 200
    assert incoming_contacts.json()[0]["direction"] == "incoming"
    assert incoming_contacts.json()[0]["status"] == "pending"

    accept_response = client.patch(
        f"/contacts/{contact_id}",
        headers=auth_headers(second_token),
        json={"status": "accepted"},
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["status"] == "accepted"

    accepted_contacts = client.get("/contacts/", headers=auth_headers(first_token))
    assert accepted_contacts.status_code == 200
    assert accepted_contacts.json()[0]["status"] == "accepted"
    assert accepted_contacts.json()[0]["peer"]["applicant_profile"]["skills"] == "React, TypeScript"

    repeat_suggestions = client.get("/contacts/suggestions", headers=auth_headers(first_token))
    assert repeat_suggestions.status_code == 200
    assert repeat_suggestions.json() == []


def test_applicants_can_recommend_opportunities_to_contacts(client, db_session):
    """Проверяет рекомендации вакансий и мероприятий между подтвержденными контактами."""
    first_user = register_user(
        client,
        email="recommend-one@example.com",
        password="supersecret",
        display_name="Recommend One",
        role="applicant",
    )
    second_user = register_user(
        client,
        email="recommend-two@example.com",
        password="supersecret",
        display_name="Recommend Two",
        role="applicant",
    )
    employer_user = register_user(
        client,
        email="recommend-employer@example.com",
        password="supersecret",
        display_name="Recommend Employer",
        role="employer",
    )
    assert first_user.status_code == 200
    assert second_user.status_code == 200
    assert employer_user.status_code == 200

    first_token = login_user(
        client,
        email="recommend-one@example.com",
        password="supersecret",
    )
    second_token = login_user(
        client,
        email="recommend-two@example.com",
        password="supersecret",
    )
    employer_token = login_user(
        client,
        email="recommend-employer@example.com",
        password="supersecret",
    )

    first_profile = client.put(
        "/profiles/me",
        headers=auth_headers(first_token),
        json={
            "display_name": "Recommend One Updated",
            "applicant_profile": {
                "full_name": "Иван Рекомендатор",
                "skills": "Python",
                "is_profile_public": True,
            },
        },
    )
    second_profile = client.put(
        "/profiles/me",
        headers=auth_headers(second_token),
        json={
            "display_name": "Recommend Two Updated",
            "applicant_profile": {
                "full_name": "Мария Получатель",
                "skills": "React",
                "is_profile_public": True,
            },
        },
    )
    assert first_profile.status_code == 200
    assert second_profile.status_code == 200

    employer_model = (
        db_session.query(models.User)
        .filter(models.User.email == "recommend-employer@example.com")
        .first()
    )
    employer_model.is_verified = True
    db_session.commit()

    create_opportunity = client.post(
        "/opportunities/",
        headers=auth_headers(employer_token),
        json={
            "title": "Frontend Event",
            "description": "Карьерное мероприятие для студентов с воркшопами, лекциями и знакомством с командой.",
            "type": "event",
            "work_format": "office",
            "location": "Санкт-Петербург",
            "tag_ids": [],
        },
    )
    assert create_opportunity.status_code == 200
    opportunity_id = create_opportunity.json()["id"]

    create_contact = client.post(
        "/contacts/",
        headers=auth_headers(first_token),
        json={"addressee_id": second_profile.json()["id"]},
    )
    assert create_contact.status_code == 201
    contact_id = create_contact.json()["id"]

    accept_contact = client.patch(
        f"/contacts/{contact_id}",
        headers=auth_headers(second_token),
        json={"status": "accepted"},
    )
    assert accept_contact.status_code == 200

    recommendation_response = client.post(
        "/recommendations/",
        headers=auth_headers(first_token),
        json={
            "recommended_user_id": second_profile.json()["id"],
            "opportunity_id": opportunity_id,
            "message": "Мне кажется, это событие подойдет под твой стек и интерес к фронтенду.",
        },
    )
    assert recommendation_response.status_code == 201
    assert recommendation_response.json()["direction"] == "outgoing"
    assert recommendation_response.json()["opportunity"]["title"] == "Frontend Event"

    my_recommendations = client.get("/recommendations/", headers=auth_headers(second_token))
    assert my_recommendations.status_code == 200
    assert len(my_recommendations.json()) == 1
    assert my_recommendations.json()[0]["direction"] == "incoming"
    assert my_recommendations.json()[0]["peer"]["display_name"] == "Recommend One Updated"
    assert my_recommendations.json()[0]["message"].startswith("Мне кажется")


def test_applicant_profile_privacy_controls_access(client, db_session):
    """Проверяет приватность профиля и видимость откликов для других соискателей."""
    private_user = register_user(
        client,
        email="privacy-private@example.com",
        password="supersecret",
        display_name="Private User",
        role="applicant",
    )
    viewer_user = register_user(
        client,
        email="privacy-viewer@example.com",
        password="supersecret",
        display_name="Viewer User",
        role="applicant",
    )
    employer_user = register_user(
        client,
        email="privacy-employer@example.com",
        password="supersecret",
        display_name="Privacy Employer",
        role="employer",
    )
    assert private_user.status_code == 200
    assert viewer_user.status_code == 200
    assert employer_user.status_code == 200

    private_token = login_user(
        client,
        email="privacy-private@example.com",
        password="supersecret",
    )
    viewer_token = login_user(
        client,
        email="privacy-viewer@example.com",
        password="supersecret",
    )
    employer_token = login_user(
        client,
        email="privacy-employer@example.com",
        password="supersecret",
    )

    private_profile = client.put(
        "/profiles/me",
        headers=auth_headers(private_token),
        json={
            "display_name": "Private User Updated",
            "applicant_profile": {
                "full_name": "Скрытый Соискатель",
                "skills": "Python",
                "bio": "Не хочу показывать профиль всем подряд.",
                "is_profile_public": False,
                "show_responses": False,
            },
        },
    )
    assert private_profile.status_code == 200
    private_user_id = private_profile.json()["id"]

    employer = (
        db_session.query(models.User)
        .filter(models.User.email == "privacy-employer@example.com")
        .first()
    )
    employer.is_verified = True
    db_session.commit()

    opportunity = client.post(
        "/opportunities/",
        headers=auth_headers(employer_token),
        json={
            "title": "Privacy Job",
            "description": "Вакансия для проверки видимости откликов и поведения приватного профиля.",
            "type": "job",
            "work_format": "remote",
            "location": "Москва",
            "tag_ids": [],
        },
    )
    assert opportunity.status_code == 200

    response = client.post(
        "/responses/",
        headers=auth_headers(private_token),
        json={
            "opportunity_id": opportunity.json()["id"],
            "cover_letter": "Отклик для проверки приватности.",
        },
    )
    assert response.status_code == 201

    forbidden_profile = client.get(
        f"/profiles/applicants/{private_user_id}",
        headers=auth_headers(viewer_token),
    )
    assert forbidden_profile.status_code == 403

    open_profile = client.put(
        "/profiles/me",
        headers=auth_headers(private_token),
        json={
            "applicant_profile": {
                "is_profile_public": True,
                "show_responses": True,
            },
        },
    )
    assert open_profile.status_code == 200

    visible_profile = client.get(
        f"/profiles/applicants/{private_user_id}",
        headers=auth_headers(viewer_token),
    )
    assert visible_profile.status_code == 200
    payload = visible_profile.json()
    assert payload["applicant_profile"]["bio"] == "Не хочу показывать профиль всем подряд."
    assert len(payload["visible_responses"]) == 1
    assert payload["visible_responses"][0]["cover_letter"] == "Отклик для проверки приватности."


def test_curator_can_verify_employers_and_moderate_opportunities(client, db_session):
    """Проверяет основные сценарии кабинета куратора."""
    curator_user = models.User(
        email="curator@example.com",
        hashed_password="hash",
        display_name="Curator",
        role="curator",
        is_active=True,
        is_verified=True,
    )
    employer_user = models.User(
        email="needs-review@example.com",
        hashed_password="hash",
        display_name="Needs Review",
        role="employer",
        is_active=True,
        is_verified=False,
    )
    db_session.add_all([curator_user, employer_user])
    db_session.commit()
    db_session.refresh(curator_user)
    db_session.refresh(employer_user)

    employer_profile = models.EmployerProfile(
        user_id=employer_user.id,
        company_name="Review Corp",
        city="Москва",
    )
    opportunity = models.Opportunity(
        employer_id=employer_user.id,
        title="Moderation target",
        description="Карточка, которую куратор должен иметь возможность скрыть или опубликовать.",
        type="job",
        work_format="office",
        location="Москва",
        is_active=True,
    )
    db_session.add_all([employer_profile, opportunity])
    db_session.commit()
    db_session.refresh(opportunity)

    token = create_access_token({"sub": curator_user.email, "role": curator_user.role})
    headers = auth_headers(token)

    users_response = client.get("/curator/users?role=employer", headers=headers)
    assert users_response.status_code == 200
    assert len(users_response.json()) == 1
    assert users_response.json()[0]["is_verified"] is False

    verify_response = client.patch(
        f"/curator/users/{employer_user.id}",
        headers=headers,
        json={
            "display_name": "Checked Employer",
            "is_verified": True,
            "employer_profile": {
                "company_name": "Review Corp Updated",
                "description": "Компания прошла ручную модерацию куратора.",
                "website": "https://review.example.com",
                "city": "Санкт-Петербург",
            },
        },
    )
    assert verify_response.status_code == 200
    assert verify_response.json()["is_verified"] is True
    assert verify_response.json()["display_name"] == "Checked Employer"
    assert verify_response.json()["employer_profile"]["company_name"] == "Review Corp Updated"

    opportunities_response = client.get("/curator/opportunities", headers=headers)
    assert opportunities_response.status_code == 200
    assert opportunities_response.json()[0]["title"] == "Moderation target"

    moderate_response = client.patch(
        f"/curator/opportunities/{opportunity.id}",
        headers=headers,
        json={
            "title": "Moderated title",
            "description": "Куратор обновил описание карточки и оставил ее скрытой после повторной проверки.",
            "location": "Санкт-Петербург",
            "salary_range": "до 120 000",
            "is_active": False,
        },
    )
    assert moderate_response.status_code == 200
    assert moderate_response.json()["is_active"] is False
    assert moderate_response.json()["title"] == "Moderated title"
    assert moderate_response.json()["location"] == "Санкт-Петербург"
