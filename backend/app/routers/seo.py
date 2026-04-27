"""SEO-маршруты для robots.txt и динамического sitemap.xml."""

from datetime import UTC, datetime
from html import escape
from typing import Optional
import json

from fastapi import APIRouter, Depends, Response, HTTPException
from fastapi.responses import PlainTextResponse, HTMLResponse
from sqlalchemy.orm import Session

from app import models
from app.database import get_db


SITE_URL = "https://tramplin.site"
TRACKING_PARAMS = "utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid"

WORK_FORMAT_LABELS = {
    'office': 'Офис',
    'hybrid': 'Гибрид',
    'remote': 'Удаленно',
}

TYPE_LABELS = {
    'internship': 'Стажировка',
    'job': 'Работа',
    'mentorship': 'Менторство',
    'event': 'Событие',
}

STATIC_URLS = (
    ("/", "daily", "1.0"),
    ("/opportunities", "daily", "0.9"),
    ("/internships", "daily", "0.9"),
    ("/jobs", "daily", "0.9"),
    ("/events", "daily", "0.8"),
    ("/about", "monthly", "0.6"),
)

router = APIRouter(tags=["seo"])


def utc_now_naive() -> datetime:
    """Возвращает текущее время UTC без timezone."""
    return datetime.now(UTC).replace(tzinfo=None)


def xml_escape(value: str) -> str:
    """Экранирует строку для безопасной вставки в XML."""
    return escape(value, quote=True)


def format_lastmod(value: Optional[datetime]) -> str:
    """Возвращает дату изменения в формате sitemap."""
    if not value:
        return utc_now_naive().date().isoformat()
    return value.date().isoformat()


def sitemap_url(path: str, lastmod: str, changefreq: str, priority: str) -> str:
    """Формирует XML-блок одного URL для sitemap."""
    loc = f"{SITE_URL}{path}"
    return "\n".join(
        [
            "  <url>",
            f"    <loc>{xml_escape(loc)}</loc>",
            f"    <lastmod>{xml_escape(lastmod)}</lastmod>",
            f"    <changefreq>{xml_escape(changefreq)}</changefreq>",
            f"    <priority>{xml_escape(priority)}</priority>",
            "  </url>",
        ]
    )


@router.get("/robots.txt", include_in_schema=False)
def robots_txt() -> PlainTextResponse:
    """Возвращает robots.txt с ссылкой на актуальный sitemap."""
    content = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /api/docs",
            "Disallow: /api/redoc",
            "Disallow: /api/openapi.json",
            "Disallow: /openapi.json",
            f"Clean-param: {TRACKING_PARAMS} /",
            "",
            f"Sitemap: {SITE_URL}/sitemap.xml",
            "",
        ]
    )
    return PlainTextResponse(content)


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap_xml(db: Session = Depends(get_db)) -> Response:
    """Возвращает sitemap со страницами и активными возможностями."""
    now = utc_now_naive()
    urls = [
        sitemap_url(path, now.date().isoformat(), changefreq, priority)
        for path, changefreq, priority in STATIC_URLS
    ]

    opportunities = (
        db.query(models.Opportunity)
        .filter(models.Opportunity.is_active.is_(True))
        .filter(
            (models.Opportunity.expires_at.is_(None))
            | (models.Opportunity.expires_at >= now)
        )
        .order_by(models.Opportunity.published_at.desc())
        .limit(1000)
        .all()
    )

    urls.extend(
        sitemap_url(
            f"/opportunities/{opportunity.id}",
            format_lastmod(opportunity.published_at),
            "weekly",
            "0.7",
        )
        for opportunity in opportunities
    )

    content = "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            *urls,
            "</urlset>",
            "",
        ]
    )
    return Response(content=content, media_type="application/xml; charset=utf-8")


@router.get("/seo/opportunities/{opp_id}", include_in_schema=False)
def seo_opportunity_render(opp_id: int, db: Session = Depends(get_db)) -> HTMLResponse:
    """Рендерит HTML для поисковых ботов (Dynamic Rendering)."""
    opportunity = db.query(models.Opportunity).filter(models.Opportunity.id == opp_id).first()
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    url = f"{SITE_URL}/opportunities/{opp_id}"
    employer_name = opportunity.employer_name or "Работодатель"
    title = f"{opportunity.title} — {employer_name} | Трамплин (Tramplin) карьерная платформа"
    desc_text = opportunity.description or ""
    description = desc_text[:150] + "..." if len(desc_text) > 150 else desc_text

    is_remote = opportunity.work_format == 'remote'

    if opportunity.type == 'event':
        schema = {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": opportunity.title,
            "description": desc_text,
            "startDate": opportunity.event_date.isoformat() if opportunity.event_date else opportunity.published_at.isoformat(),
            "location": {"@type": "VirtualLocation", "url": url} if is_remote else {
                "@type": "Place",
                "name": opportunity.location,
                "address": opportunity.location
            },
            "organizer": {
                "@type": "Organization",
                "name": employer_name
            }
        }
    else:
        schema = {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": opportunity.title,
            "description": desc_text,
            "datePosted": opportunity.published_at.isoformat(),
            "validThrough": opportunity.expires_at.isoformat() if opportunity.expires_at else None,
            "employmentType": "INTERN" if opportunity.type == 'internship' else "FULL_TIME",
            "hiringOrganization": {
                "@type": "Organization",
                "name": employer_name
            },
            "jobLocationType": "TELECOMMUTE" if is_remote else None,
            "jobLocation": None if is_remote else {
                "@type": "Place",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": opportunity.location,
                    "addressCountry": "RU"
                }
            }
        }

    schema = {k: v for k, v in schema.items() if v is not None}

    html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(description)}">
    <meta property="og:title" content="{escape(title)}">
    <meta property="og:description" content="{escape(description)}">
    <meta property="og:url" content="{escape(url)}">
    <meta property="og:type" content="website">
    <link rel="canonical" href="{escape(url)}">
    <script type="application/ld+json">
    {json.dumps(schema, ensure_ascii=False)}
    </script>
</head>
<body>
    <h1>{escape(opportunity.title)}</h1>
    <p><strong>Компания:</strong> {escape(employer_name)}</p>
    <p><strong>Тип:</strong> {escape(TYPE_LABELS.get(opportunity.type or '', opportunity.type or ''))}</p>
    <p><strong>Формат:</strong> {escape(WORK_FORMAT_LABELS.get(opportunity.work_format or '', opportunity.work_format or ''))}</p>
    <p><strong>Локация:</strong> {escape(opportunity.location or '')}</p>
    <article>
        {escape(desc_text)}
    </article>
</body>
</html>'''

    return HTMLResponse(content=html)
