"""Auth endpoints. This story ships these three and nothing else — the scoped
resource endpoints they protect are story 04.

The health endpoint lives in config/health.py — it belongs to the deployment,
not to a domain.
"""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .audit import audit_login_failure, audit_login_success, audit_password_changed
from .models import Branch, Department
from .serializers import (
    BranchSerializer,
    ChangePasswordSerializer,
    DepartmentSerializer,
    LoginSerializer,
    MeSerializer,
    MeUpdateSerializer,
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
    description=(
        "GET returns the full profile. PATCH accepts only `phone` and `language` — "
        "role, department, branch and tier are Django admin's job in this MVP."
    ),
    responses={200: MeSerializer},
)
class MeView(RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        return MeUpdateSerializer if self.request.method == "PATCH" else MeSerializer

    def update(self, request, *args, **kwargs):
        # PATCH is validated and saved through the narrow write serializer,
        # but the response is always the full MeSerializer shape — the same
        # "write serializer in, detail serializer out" rule story 08 learned
        # the hard way (a write-serializer response is a narrower shape than
        # what the very next render reads, and seeding a cache from it is how
        # that story's three cache-poisoning bugs happened).
        super().update(request, *args, **kwargs)
        return Response(MeSerializer(request.user).data)


@extend_schema(
    summary="Change the caller's own password",
    request=ChangePasswordSerializer,
    responses={200: OpenApiResponse(description="Password changed."), 400: OpenApiResponse()},
)
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        # A password-only save produces an empty diff (password is excluded
        # from the tracked fields), so the generic post_save audit signal
        # skips it as a no-op — this needs its own explicit call, the same way
        # login does.
        audit_password_changed(request.user)
        return Response(status=status.HTTP_200_OK)


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
