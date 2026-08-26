from django.contrib import admin

from .models import KBArticle, KBCategory


@admin.register(KBCategory)
class KBCategoryAdmin(admin.ModelAdmin):
    list_display = ("order", "slug", "name_en", "name_ar", "article_count")
    list_filter = ("order",)
    search_fields = ("slug", "name_en", "name_ar")
    ordering = ("order", "slug")

    @admin.display(description="articles")
    def article_count(self, obj):
        return obj.articles.count()


@admin.register(KBArticle)
class KBArticleAdmin(admin.ModelAdmin):
    list_display = (
        "title_en", "slug", "category", "status", "has_arabic",
        "author", "view_count", "helpful_count", "updated_at",
    )
    list_filter = ("status", "category", "created_at")
    search_fields = ("title_en", "title_ar", "body_en", "body_ar", "slug")
    ordering = ("-updated_at",)
    list_select_related = ("category", "author")
    prepopulated_fields = {"slug": ("title_en",)}
    readonly_fields = ("created_at", "updated_at", "view_count", "helpful_count")

    @admin.display(boolean=True, description="Arabic")
    def has_arabic(self, obj):
        """Story 08 renders the same signal as a completeness indicator."""
        return bool(obj.title_ar and obj.body_ar)
