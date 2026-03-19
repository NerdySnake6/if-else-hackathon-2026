"""Интеграционные тесты для основных пользовательских сценариев."""

from datetime import datetime, timedelta

from app import models


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
