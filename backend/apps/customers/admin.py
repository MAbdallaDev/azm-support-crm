from django.contrib import admin

from .models import Contact, Customer, CustomerNote


class ContactInline(admin.TabularInline):
    model = Contact
    extra = 0
    fields = ("name", "email", "phone", "position", "is_primary")


class CustomerNoteInline(admin.TabularInline):
    model = CustomerNote
    extra = 0
    fields = ("author", "body", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "name", "company", "email", "phone", "tier", "branch",
        "preferred_language", "created_at",
    )
    list_filter = ("tier", "branch", "preferred_language", "created_at")
    search_fields = ("name", "company", "email", "phone", "whatsapp")
    ordering = ("name",)
    list_select_related = ("branch",)
    readonly_fields = ("created_at", "updated_at")
    inlines = [ContactInline, CustomerNoteInline]


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ("name", "customer", "position", "email", "phone", "is_primary")
    list_filter = ("is_primary", "customer__tier")
    search_fields = ("name", "email", "phone", "customer__name", "customer__company")
    ordering = ("-is_primary", "name")
    list_select_related = ("customer",)


@admin.register(CustomerNote)
class CustomerNoteAdmin(admin.ModelAdmin):
    list_display = ("customer", "author", "short_body", "created_at")
    list_filter = ("created_at", "author")
    search_fields = ("body", "customer__name", "customer__company")
    ordering = ("-created_at",)
    list_select_related = ("customer", "author")
    readonly_fields = ("created_at",)

    @admin.display(description="body")
    def short_body(self, obj):
        return obj.body[:60]
