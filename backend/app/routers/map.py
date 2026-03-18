"""Маршруты, связанные с картой и серверным геокодированием."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_active_user
from app.geocoder import GeocodingError, geocode_address, geocoder_is_configured
from app.models import User
from app.schemas import GeocodeResult


router = APIRouter(prefix="/map", tags=["map"])


@router.get("/geocode", response_model=GeocodeResult)
def geocode(
    address: str = Query(..., min_length=3, description="Address to geocode"),
    current_user: User = Depends(get_current_active_user),
):
    """Геокодирует адрес через серверную интеграцию с Яндексом."""
    if not geocoder_is_configured():
        raise HTTPException(
            status_code=503,
            detail="Yandex geocoder is not configured on the server",
        )

    try:
        result = geocode_address(address)
    except GeocodingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if result is None:
        raise HTTPException(status_code=404, detail="Address not found")

    return result
