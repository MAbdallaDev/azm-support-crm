"""Knowledge base serializers.

Bilingual pairs are exposed as-is (`title_en` / `title_ar`); the client picks the
language. `title_ar` and `body_ar` are blank-able on purpose — story 08's editor
shows a per-language completeness indicator and warns before publishing a
single-language article, and that flow only exists if a half-translated article
is representable.
"""

from rest_framework import serializers

from apps.kb.models import KBArticle, KBCategory


class KBCategorySerializer(serializers.ModelSerializer):
    article_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = KBCategory
        fields = ("id", "slug", "name_en", "name_ar", "order", "article_count")


class KBArticleListSerializer(serializers.ModelSerializer):
    """The browse list. Bodies are deliberately absent — ten full articles is a
    large payload and story 08's list renders titles only.
    """

    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    category_name = serializers.CharField(source="category.name_en", read_only=True, default="")
    has_arabic = serializers.SerializerMethodField()

    class Meta:
        model = KBArticle
        fields = (
            "id", "slug", "title_en", "title_ar", "category", "category_name",
            "status", "has_arabic", "view_count", "helpful_count", "updated_at",
        )

    def get_has_arabic(self, obj) -> bool:
        """Drives story 08's completeness indicator."""
        return bool(obj.title_ar and obj.body_ar)


class KBArticleDetailSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    category_name = serializers.CharField(source="category.name_en", read_only=True, default="")
    author_name = serializers.SerializerMethodField()
    has_arabic = serializers.SerializerMethodField()

    class Meta:
        model = KBArticle
        fields = (
            "id", "slug", "title_en", "title_ar", "body_en", "body_ar",
            "category", "category_name", "status", "author", "author_name",
            "has_arabic", "view_count", "helpful_count", "created_at", "updated_at",
        )
        read_only_fields = ("id", "view_count", "helpful_count", "created_at", "updated_at")

    def get_author_name(self, obj) -> str:
        if obj.author is None:
            return ""
        return obj.author.get_full_name() or obj.author.get_username()

    def get_has_arabic(self, obj) -> bool:
        return bool(obj.title_ar and obj.body_ar)


class KBArticleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = KBArticle
        fields = (
            "id", "slug", "title_en", "title_ar", "body_en", "body_ar",
            "category", "status",
        )
        read_only_fields = ("id",)
