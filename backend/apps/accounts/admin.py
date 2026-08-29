"""Django admin is this product's back-office — the "Admin" nav item links here,
not to a React screen. Odoo mental map: these are the backend list/form views.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import AuditLog, Branch, Department, Notification, User


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name_en", "name_ar")
    list_filter = ("code",)
    search_fields = ("code", "name_en", "name_ar")
    ordering = ("code",)


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("code", "name_en", "name_ar")
    list_filter = ("code",)
    search_fields = ("code", "name_en", "name_ar")
    ordering = ("code",)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Extends the contrib UserAdmin rather than a bare ModelAdmin, so the
    password field keeps its hashing widget instead of storing plain text.
    """

    list_display = (
        "username", "email", "get_full_name", "role", "department", "branch",
        "tier", "language", "is_available", "is_staff",
    )
    list_filter = ("role", "department", "branch", "is_available", "is_staff", "is_active")
    search_fields = ("username", "email", "first_name", "last_name", "phone")
    ordering = ("username",)
    list_select_related = ("department", "branch")

    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "CRM profile",
            {
                "fields": (
                    "role", "phone", "department", "branch", "tier",
                    "language", "is_available", "customer",
                )
            },
        ),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (
            "CRM profile",
            {
                "fields": (
                    "email", "role", "phone", "department", "branch", "tier",
                    "language", "is_available", "customer",
                )
            },
        ),
    )


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("created_at", "recipient", "verb", "actor", "ticket", "read_at")
    list_filter = ("verb", "created_at")
    search_fields = ("recipient__username", "actor__username", "ticket__number")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = ("recipient", "actor", "ticket")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """An audit trail that can be edited is not an audit trail."""

    list_display = ("created_at", "actor", "action", "model_name", "object_id")
    list_filter = ("action", "model_name", "created_at")
    search_fields = ("model_name", "object_id", "actor__username")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = ("actor",)
    readonly_fields = ("actor", "action", "model_name", "object_id", "changes", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
