"""Auth endpoints. This story ships these three and nothing else — the scoped
resource endpoints they protect are story 04.

The health endpoint lives in config/health.py — it belongs to the deployment,
not to a domain.
"""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import viewsets
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .audit import audit_login_failure, audit_login_success
from .models import Branch, Department
from .serializers import (
    BranchSerializer,
    DepartmentSerializer,
    LoginSerializer,
    MeSerializer,
)


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


@extend_schema(tags=["accounts"], summary="Every branch")
class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    """Six branches that change roughly never — the customer list's branch
    filter (story 08) needs somewhere to read the options from, since
    `CustomerFilterSet.branch` filters by primary key and nothing until now
    listed what those keys are.

    Unpaginated on purpose: a dropdown with six options is not a list that
    benefits from paging, and a paginated response would make the client do
    an extra round trip just to populate a `<select>`.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = BranchSerializer
    queryset = Branch.objects.all()
    pagination_class = None


@extend_schema(tags=["accounts"], summary="Every department")
class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    """Story 09's reports filter by department and need the same list this
    story's customer filter needed for branches — added alongside it rather
    than as a separate later addition, since the two are the same eight lines
    of a `ReadOnlyModelViewSet` each.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all()
    pagination_class = None
