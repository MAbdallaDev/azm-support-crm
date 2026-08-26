"""Ticket numbering: sequential, preserved when supplied, and unique under load.

The generation strategy is a `unique=True` column plus a bounded retry — see the
comment block above `next_ticket_number` in `apps/tickets/models.py` for why
neither `select_for_update` nor a database sequence is used.
"""

from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import connection, connections

from apps.customers.models import Customer
from apps.tickets.models import Ticket


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Acme", email="ops@acme.test")


@pytest.mark.django_db
def test_numbers_are_sequential(customer):
    numbers = [
        Ticket.objects.create(customer=customer, subject=f"Ticket {i}").number
        for i in range(3)
    ]
    assert numbers == ["TK-0001", "TK-0002", "TK-0003"]


@pytest.mark.django_db
def test_supplied_number_is_preserved(customer):
    """seed_demo relies on this: it keys tickets on their number so a second run
    matches instead of appending.
    """
    ticket = Ticket.objects.create(
        customer=customer, subject="Imported", number="TK-9042"
    )
    assert ticket.number == "TK-9042"
    assert Ticket.objects.get(pk=ticket.pk).number == "TK-9042"

    # And the next generated number continues from it rather than colliding.
    assert Ticket.objects.create(customer=customer, subject="Next").number == "TK-9043"


class TestConcurrency:
    """SQLite serialises writes and raises 'database is locked' under threads, so
    the real race is only exercised against PostgreSQL. A skip with a stated
    reason is honest; a green test on SQLite that never raced would not be.
    """

    pytestmark = pytest.mark.skipif(
        connection.vendor != "postgresql",
        reason=(
            "SQLite serialises writes and raises 'database is locked' under threads; "
            "the real race is only exercised against PostgreSQL "
            "(docker compose exec api pytest)."
        ),
    )

    @pytest.mark.django_db(transaction=True)
    def test_fifty_concurrent_creates_get_fifty_distinct_numbers(self, customer):
        def create(i):
            try:
                return Ticket.objects.create(
                    customer=customer, subject=f"Concurrent {i}"
                ).number
            finally:
                # Each worker thread opens its own connection; leaving them open
                # makes the post-test database teardown hang.
                connections.close_all()

        with ThreadPoolExecutor(max_workers=16) as pool:
            numbers = list(pool.map(create, range(50)))

        assert len(numbers) == 50
        assert len(set(numbers)) == 50, "ticket numbers were reused under concurrency"
        assert Ticket.objects.count() == 50
