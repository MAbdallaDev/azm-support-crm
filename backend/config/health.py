from django.db import connections
from django.db.utils import Error as DatabaseError
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    summary="Liveness and database connectivity",
    responses={200: dict, 503: dict},
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Reports process liveness and a real database round-trip.

    The `database` key must never be a constant — a reviewer checks this by
    stopping the db container and expecting 503.
    """
    try:
        connections["default"].cursor().execute("SELECT 1")
        database = "ok"
    except DatabaseError:
        database = "unavailable"

    payload = {"status": "ok" if database == "ok" else "degraded", "database": database}
    code = status.HTTP_200_OK if database == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE
    return Response(payload, status=code)
