from django.apps import AppConfig


class AiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ai"
    verbose_name = "AI"

    def ready(self):
        """Resolve the configured backend at startup so a misconfiguration is a
        boot failure rather than a 500 on the first request.

        `AI_BACKEND="claude"` with no API key raises ImproperlyConfigured here,
        which is exactly the intent: noticed by whoever changed the setting,
        not by whoever is watching the demo.
        """
        from django.conf import settings

        if (getattr(settings, "AI_BACKEND", "mock") or "mock").lower() == "mock":
            # The default needs no validation and importing it eagerly would pull
            # models in before the registry is ready in some management commands.
            return

        from apps.ai.services import get_backend

        get_backend()
