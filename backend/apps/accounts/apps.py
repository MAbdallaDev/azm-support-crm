from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    verbose_name = "Accounts"

    def ready(self):
        # Connected here rather than at module import: import time runs before
        # the app registry is populated, so resolving the audited models would
        # raise.
        from . import audit

        audit.connect()
