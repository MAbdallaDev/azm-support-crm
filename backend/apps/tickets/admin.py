from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Attachment,
    CannedReply,
    Category,
    CSATRating,
    SLAPolicy,
    Tag,
    Ticket,
    TicketEvent,
    TicketMessage,
)


class TicketMessageInline(admin.StackedInline):
    model = TicketMessage
    extra = 0
    fields = ("author", "body", "is_internal", "channel", "created_at")
    readonly_fields = ("created_at",)


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0
    fields = ("file", "filename", "size", "uploaded_by", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("slug", "name_en", "name_ar", "default_priority")
    list_filter = ("default_priority",)
    search_fields = ("slug", "name_en", "name_ar")
    ordering = ("slug",)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_ar", "swatch", "color")
    list_filter = ("color",)
    search_fields = ("name_en", "name_ar")
    ordering = ("name_en",)

    @admin.display(description="")
    def swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:14px;height:14px;'
            'border-radius:3px;background:{}"></span>',
            obj.color,
        )


@admin.register(SLAPolicy)
class SLAPolicyAdmin(admin.ModelAdmin):
    list_display = (
        "name", "customer_tier", "priority", "first_response_minutes",
        "resolution_minutes", "escalate_at_percent", "is_active",
    )
    list_filter = ("customer_tier", "priority", "is_active")
    search_fields = ("name",)
    ordering = ("customer_tier", "priority")


@admin.register(CannedReply)
class CannedReplyAdmin(admin.ModelAdmin):
    list_display = ("shortcut", "title_en", "title_ar", "category")
    list_filter = ("category",)
    search_fields = ("shortcut", "title_en", "title_ar", "body_en", "body_ar")
    ordering = ("shortcut",)
    list_select_related = ("category",)


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = (
        "number", "subject", "customer", "status", "priority", "channel",
        "assignee", "sla_resolution_due_at", "created_at",
    )
    list_filter = ("status", "priority", "channel", "department", "branch", "category")
    search_fields = ("number", "subject", "customer__name", "customer__company")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = (
        "number", "created_at", "updated_at", "first_response_at", "resolved_at",
        "closed_at", "sla_response_due_at", "sla_resolution_due_at",
    )
    inlines = [TicketMessageInline, AttachmentInline]
    filter_horizontal = ("tags", "watchers")
    autocomplete_fields = ("customer", "contact", "assignee", "created_by")
    # Without this the changelist issues one query per row for each of the four
    # FK columns it renders — ~600 queries for a 150-row page.
    list_select_related = ("customer", "assignee", "category", "department")

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("tags")


@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ("ticket", "author", "short_body", "is_internal", "channel", "created_at")
    list_filter = ("is_internal", "channel", "created_at")
    search_fields = ("body", "ticket__number", "ticket__subject", "author__username")
    ordering = ("-created_at",)
    list_select_related = ("ticket", "author")
    readonly_fields = ("created_at",)

    @admin.display(description="body")
    def short_body(self, obj):
        return obj.body[:60]


@admin.register(TicketEvent)
class TicketEventAdmin(admin.ModelAdmin):
    """Not an inline on TicketAdmin on purpose: the activity log is append-only
    and long, so it gets its own read-only changelist instead of bloating every
    ticket form.
    """

    list_display = ("created_at", "ticket", "actor", "event_type", "field", "old_value", "new_value")
    list_filter = ("event_type", "field", "created_at")
    search_fields = ("ticket__number", "actor__username", "event_type", "field")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = ("ticket", "actor")
    readonly_fields = (
        "ticket", "actor", "event_type", "field", "old_value", "new_value", "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("filename", "ticket", "message", "size", "uploaded_by", "created_at")
    list_filter = ("created_at",)
    search_fields = ("filename", "ticket__number", "uploaded_by__username")
    ordering = ("-created_at",)
    list_select_related = ("ticket", "message", "uploaded_by")
    readonly_fields = ("created_at",)


@admin.register(CSATRating)
class CSATRatingAdmin(admin.ModelAdmin):
    list_display = ("ticket", "score", "short_comment", "created_at")
    list_filter = ("score", "created_at")
    search_fields = ("ticket__number", "comment")
    ordering = ("-created_at",)
    list_select_related = ("ticket",)
    readonly_fields = ("created_at",)

    @admin.display(description="comment")
    def short_comment(self, obj):
        return obj.comment[:60]
