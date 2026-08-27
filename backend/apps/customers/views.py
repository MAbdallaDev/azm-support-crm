"""Agent-facing REST API for customers, contacts and notes."""

from drf_spectacular.utils import extend_schema
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from django.db.models import ProtectedError

from apps.accounts.permissions import IsAgentOrAbove
from apps.accounts.scoping import ScopedQuerySetMixin, scope_customers
from apps.customers.filters import CustomerFilterSet
from apps.customers.models import Contact, Customer, CustomerNote
from apps.customers.serializers import (
    ContactSerializer,
    CustomerDetailSerializer,
    CustomerListSerializer,
    CustomerNoteSerializer,
    CustomerWriteSerializer,
    annotate_open_ticket_count,
)
from apps.tickets.pagination import StandardPagination


class CustomerViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAgentOrAbove]
    scope_function = staticmethod(scope_customers)
    queryset = Customer.objects.all()
    pagination_class = StandardPagination
    filterset_class = CustomerFilterSet
    # Declared per-viewset rather than globally: the lookup endpoints stay
    # cheap by not paying for search and ordering machinery they never use.
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ("name", "company", "email", "phone")
    ordering_fields = ("name", "created_at", "tier")
    ordering = ("name",)

    def get_queryset(self):
        qs = super().get_queryset().select_related("branch")
        if self.action == "list":
            # One join rather than a count query per row.
            return annotate_open_ticket_count(qs)
        if self.action == "retrieve":
            return qs.prefetch_related("contacts")
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return CustomerListSerializer
        if self.action in ("create", "update", "partial_update"):
            return CustomerWriteSerializer
        return CustomerDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        """`Ticket.customer` is PROTECT, so deleting a customer with tickets
        raises ProtectedError. Unhandled that is a 500; it is a client error and
        deserves a 400 that says what to do about it.
        """
        try:
            instance.delete()
        except ProtectedError as exc:
            count = instance.tickets.count()
            raise ValidationError(
                {
                    "detail": (
                        f"Cannot delete this customer: {count} ticket(s) still reference "
                        "it. Reassign or delete those tickets first."
                    )
                }
            ) from exc

    @extend_schema(
        summary="Internal notes on a customer",
        request=CustomerNoteSerializer,
        responses={200: CustomerNoteSerializer(many=True), 201: CustomerNoteSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):
        customer = self.get_object()
        if request.method == "GET":
            qs = customer.notes.select_related("author").all()
            return Response(CustomerNoteSerializer(qs, many=True).data)

        serializer = CustomerNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save(customer=customer, author=request.user)
        return Response(
            CustomerNoteSerializer(note).data, status=http_status.HTTP_201_CREATED
        )


class ContactViewSet(viewsets.ModelViewSet):
    """Scoped through the customer the contact belongs to, not directly.

    A contact has no branch or tier of its own, so reusing `scope_customers` on
    the parent is what keeps the two consistent — a contact must never be
    visible when its customer is not.
    """

    permission_classes = [IsAgentOrAbove]
    queryset = Contact.objects.select_related("customer").all()
    serializer_class = ContactSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["customer", "is_primary"]
    ordering_fields = ("name", "is_primary")
    ordering = ("-is_primary", "name")

    def get_queryset(self):
        visible = scope_customers(Customer.objects.all(), self.request.user)
        return super().get_queryset().filter(customer__in=visible)
