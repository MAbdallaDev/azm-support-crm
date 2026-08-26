"""
Django settings for the AZM Squad Customer Support CRM.

Every environment-specific value is read from the environment. `.env.example`
at the repository root documents the full set.
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")


def env_bool(key: str, default: bool = False) -> bool:
    return os.getenv(key, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(key: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(key, default).split(",") if item.strip()]


# At least 32 bytes: SimpleJWT signs with HMAC-SHA256, and PyJWT warns on every
# token operation below that. Always overridden in any real deployment.
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-key-change-me-in-production")
DEBUG = env_bool("DEBUG", True)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1,api")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # local — one Django app per domain, the rough equivalent of an Odoo module
    "apps.accounts",
    "apps.customers",
    "apps.tickets",
    "apps.kb",
    "apps.ai",
    "apps.reports",
    "apps.portal",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # After AuthenticationMiddleware: it needs request.user to already exist.
    "apps.accounts.middleware.CurrentActorMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# DATABASE_URL absent -> SQLite, so the project runs without Docker.
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Set before the first migration ever ran — AUTH_USER_MODEL cannot be changed
# afterwards without deleting and regenerating every migration file.
AUTH_USER_MODEL = "accounts.User"

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Riyadh")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    # Deny by default. Anything public says so explicitly — see config/urls.py,
    # config/health.py and SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"] below.
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "60"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "AZM Squad Customer Support CRM API",
    "DESCRIPTION": "Multi-channel customer support CRM — tickets, SLA, knowledge base, portal.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # DEFAULT_PERMISSION_CLASSES above applies to drf-spectacular's own views too,
    # which would make /api/v1/schema/ and /api/v1/docs/ return 401 — a regression
    # invisible until a reviewer opens the link. Public, and deliberately so.
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
    # Several models share the same choice set — `en|ar` on both User and
    # Customer, and the Priority vocabulary on Category, SLAPolicy and Ticket.
    # Without these, drf-spectacular emits LanguageEnum / LanguageEnum2 and the
    # generated client in story 06 gets two names for one concept.
    # The class itself, not `.choices`: drf-spectacular's deep_import_string
    # cannot reach the metaclass property, and its loader calls `.choices` for a
    # Choices subclass anyway.
    "ENUM_NAME_OVERRIDES": {
        "LanguageEnum": "apps.accounts.models.User.Language",
        "PriorityEnum": "apps.tickets.models.Priority",
    },
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
