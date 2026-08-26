"""Auth endpoints. This story ships these three and nothing else — the scoped
resource endpoints they protect are story 04.

The health endpoint lives in config/health.py — it belongs to the deployment,
not to a domain.
"""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .audit import audit_login_failure, audit_login_success
from .serializers import LoginSerializer, MeSerializer


@extend_schema(
    summary="Log in and obtain a token pair",
    description=(
        "Accepts a username **or** an email address in the `username` field. Returns an "
        "access token, a refresh token, and the caller's profile. The access token carries "
        "a `role` claim."
    ),
    responses={200: OpenApiResponse(description="access, refresh and user payload")},
)
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        identifier = request.data.get("username", "")
        response = super().post(request, *args, **kwargs)
        # Audited here rather than in the serializer: only the view knows the
        # final outcome, and a 401 raised during validation never reaches the
        # serializer's return path.
        audit_login_success(response.data.get("user", {}).get("id"), identifier)
        return response

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        if response.status_code == 401:
            audit_login_failure(self.request.data.get("username", ""))
        return response


@extend_schema(
    summary="Exchange a refresh token for a new access token",
    responses={200: OpenApiResponse(description="a fresh access token")},
)
class RefreshView(TokenRefreshView):
    """SimpleJWT's view, re-exported so the URL module imports one place and
    `@extend_schema` can describe it.
    """


@extend_schema(
    summary="The authenticated caller's own profile",
    responses={200: MeSerializer},
)
class MeView(RetrieveAPIView):
    serializer_class = MeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user
