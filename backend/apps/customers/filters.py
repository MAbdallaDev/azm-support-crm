"""Customer list filters."""

import django_filters as filters
from django.db.models import Q

from apps.customers.models import Customer


class CustomerFilterSet(filters.FilterSet):
    tier = filters.MultipleChoiceFilter(choices=Customer.Tier.choices)
    q = filters.CharFilter(method="filter_q", label="Name, company, email or phone")

    class Meta:
        model = Customer
        fields = ["tier", "branch", "preferred_language"]

    def filter_q(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(name__icontains=value)
            | Q(company__icontains=value)
            | Q(email__icontains=value)
            | Q(phone__icontains=value)
        )
