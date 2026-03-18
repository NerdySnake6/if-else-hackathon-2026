"""Вспомогательные функции для серверного геокодирования через Яндекс."""

import json
import os
from typing import Optional
from urllib.parse import urlencode
from urllib.request import urlopen


YANDEX_GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/"
YANDEX_GEOCODER_API_KEY_ENV = "YANDEX_GEOCODER_API_KEY"


class GeocodingError(Exception):
    """Ошибка при обращении к геокодеру или разборе его ответа."""

    pass


def geocoder_is_configured() -> bool:
    """Проверяет, доступен ли ключ Яндекс Геокодера в окружении."""
    return bool(os.getenv(YANDEX_GEOCODER_API_KEY_ENV))


def geocode_address(address: str) -> Optional[dict]:
    """Преобразует адрес в координаты через HTTP Геокодер Яндекса."""
    api_key = os.getenv(YANDEX_GEOCODER_API_KEY_ENV)
    if not api_key:
        raise GeocodingError(
            f"Environment variable {YANDEX_GEOCODER_API_KEY_ENV} is not set"
        )

    query = address.strip()
    if not query:
        raise GeocodingError("Address is empty")

    params = urlencode(
        {
            "apikey": api_key,
            "geocode": query,
            "format": "json",
            "results": 1,
            "lang": "ru_RU",
        }
    )

    try:
        with urlopen(f"{YANDEX_GEOCODER_URL}?{params}", timeout=5) as response:
            payload = json.load(response)
    except Exception as exc:
        raise GeocodingError("Failed to reach Yandex Geocoder") from exc

    members = (
        payload.get("response", {})
        .get("GeoObjectCollection", {})
        .get("featureMember", [])
    )
    if not members:
        return None

    geo_object = members[0].get("GeoObject", {})
    pos = (
        geo_object.get("Point", {})
        .get("pos", "")
        .split()
    )
    if len(pos) != 2:
        raise GeocodingError("Invalid geocoder response")

    lng, lat = pos
    metadata = (
        geo_object.get("metaDataProperty", {})
        .get("GeocoderMetaData", {})
    )

    return {
        "lat": float(lat),
        "lng": float(lng),
        "formatted_address": metadata.get("text") or query,
        "precision": metadata.get("precision"),
    }
