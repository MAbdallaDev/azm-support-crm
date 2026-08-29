"""Auth serializers.

Odoo mental map: `LoginSerializer` is the equivalent of the `/web/session/authenticate`
handshake — it exchanges credentials for a session, except the session here is a
signed token the client carries rather than a cookie the server remembers.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Branch, Department

User = get_user_model()


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ("id", "code", "name_en", "name_ar")


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "code", "name_en", "name_ar")


class MeSerializer(serializers.ModelSerializer):
    """The caller's own profile. Story 06's app shell reads `role` from this to
    decide which navigation items exist.
    """

    full_name = serializers.SerializerMethodField()
    department = serializers.SlugRelatedField(slug_field="code", read_only=True)
    branch = serializers.SlugRelatedField(slug_field="code", read_only=True)

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "full_name", "role", "phone",
            "department", "branch", "tier", "language", "is_available",
        )

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.get_username()


class MeUpdateSerializer(serializers.ModelSerializer):
    """The self-service half of a profile: only `phone` and `language` are the
    caller's own to change. Everything else on `Me` — role, department, branch,
    tier — is Django admin's job in this MVP, the same call the brief already
    makes for every other piece of org structure.
    """

    class Meta:
        model = User
        fields = ("phone", "language")


class ChangePasswordSerializer(serializers.Serializer):
    """Requires the current password so a stolen access token alone cannot
    lock the real owner out of their own account.
    """

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class LoginSerializer(TokenObtainPairSerializer):
    """Accepts a username **or** an email address in the `username` field.

    seed_demo creates users as username="admin@demo" / email="admin@demo.local",
    and the README documents the former. Resolving both means the documented
    credentials work, and story 09's portal registration can key on a real email
    without a second login path. Username is tried first, so a username that
    happens to look like an address is never shadowed by someone else's email.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["name"] = user.get_full_name() or user.get_username()
        return token

    def validate(self, attrs):
        identifier = attrs.get(self.username_field, "")
        if identifier and not User.objects.filter(**{self.username_field: identifier}).exists():
            match = User.objects.filter(email__iexact=identifier).first()
            if match is not None:
                attrs[self.username_field] = match.get_username()
        data = super().validate(attrs)
        data["user"] = MeSerializer(self.user).data
        return data
