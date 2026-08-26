"""Knowledge base — bilingual articles, browsed in the app and in the portal."""

from django.conf import settings
from django.db import models


class KBCategory(models.Model):
    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120)
    slug = models.SlugField(max_length=64, unique=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "slug"]
        verbose_name = "KB category"
        verbose_name_plural = "KB categories"

    def __str__(self) -> str:
        return self.name_en


class KBArticle(models.Model):
    """`title_ar` and `body_ar` are blank-able on purpose.

    Story 08's editor shows a per-language completeness indicator and warns
    before publishing a single-language article — a flow that only exists if a
    half-translated article is representable in the first place.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    title_en = models.CharField(max_length=240)
    title_ar = models.CharField(max_length=240, blank=True)
    body_en = models.TextField()
    body_ar = models.TextField(blank=True)
    slug = models.SlugField(max_length=80, unique=True)
    category = models.ForeignKey(
        KBCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="articles"
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="kb_articles",
    )
    view_count = models.PositiveIntegerField(default=0)
    helpful_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "KB article"

    def __str__(self) -> str:
        return self.title_en
