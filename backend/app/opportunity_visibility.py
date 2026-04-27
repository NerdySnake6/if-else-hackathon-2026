"""Общие правила публичной видимости карточек возможностей."""

from datetime import UTC, datetime

from sqlalchemy import or_

from app import models


def utc_now_naive() -> datetime:
    """Возвращает текущее время UTC без timezone."""
    return datetime.now(UTC).replace(tzinfo=None)


def public_opportunity_filters(now: datetime | None = None):
    """Возвращает SQLAlchemy-фильтры для публично доступных карточек."""
    checked_at = now or utc_now_naive()
    return (
        models.Opportunity.is_active.is_(True),
        or_(
            models.Opportunity.expires_at.is_(None),
            models.Opportunity.expires_at >= checked_at,
        ),
    )
