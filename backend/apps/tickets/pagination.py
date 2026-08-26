"""Per-viewset pagination.

Set on the viewsets that need it rather than as a global REST_FRAMEWORK
default, so a later story can page a heavy endpoint differently without
touching every other one.
"""

from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    # Capped so a client cannot ask for the whole table in one request and turn
    # the queue endpoint into an accidental export.
    max_page_size = 100
