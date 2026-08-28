"""Report response shapes.

Declared as serializers purely so drf-spectacular types them — nothing here
writes. Story 06 generates its client from this schema, and an untyped
aggregation endpoint is one the frontend has to guess at.

Durations are **integer seconds** throughout. Formatting "2h 14m" is a
presentation concern and depends on the display language, so it belongs in the
client, not in a JSON payload.
"""

from rest_framework import serializers


class OverviewReportSerializer(serializers.Serializer):
    days = serializers.IntegerField()
    total = serializers.IntegerField()
    open = serializers.IntegerField()
    resolved_today = serializers.IntegerField()
    breached = serializers.IntegerField()
    avg_first_response_seconds = serializers.IntegerField(allow_null=True)
    avg_resolution_seconds = serializers.IntegerField(allow_null=True)
    sla_compliance_percent = serializers.FloatField(allow_null=True)
    csat_average = serializers.FloatField(allow_null=True)


class BucketSerializer(serializers.Serializer):
    key = serializers.CharField()
    count = serializers.IntegerField()


class DayChannelBucketSerializer(serializers.Serializer):
    """One row per (day, channel) — a flat list rather than a nested
    `{day: {channel: count}}`. Recharts' multi-line input wants one row per
    x-value with a key per series; pivoting a flat list into that shape is a
    few lines on the client, and a nested structure would need unpivoting
    for no benefit over the flat bucket shape the other three groupings
    already use.
    """

    day = serializers.CharField()
    channel = serializers.CharField()
    count = serializers.IntegerField()


class VolumeReportSerializer(serializers.Serializer):
    days = serializers.IntegerField()
    by_status = BucketSerializer(many=True)
    by_priority = BucketSerializer(many=True)
    by_channel = BucketSerializer(many=True)
    by_day = BucketSerializer(many=True)
    by_day_channel = DayChannelBucketSerializer(many=True)


class AgentRowSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    full_name = serializers.CharField()
    department = serializers.CharField(allow_blank=True)
    assigned = serializers.IntegerField()
    resolved = serializers.IntegerField()
    avg_first_response_seconds = serializers.IntegerField(allow_null=True)
    sla_compliance_percent = serializers.FloatField(allow_null=True)
    csat_average = serializers.FloatField(allow_null=True)


class AgentsReportSerializer(serializers.Serializer):
    days = serializers.IntegerField()
    agents = AgentRowSerializer(many=True)


class CSATBucketSerializer(serializers.Serializer):
    score = serializers.IntegerField()
    count = serializers.IntegerField()


class CSATReportSerializer(serializers.Serializer):
    days = serializers.IntegerField()
    average = serializers.FloatField(allow_null=True)
    count = serializers.IntegerField()
    distribution = CSATBucketSerializer(many=True)


class MySummarySerializer(serializers.Serializer):
    """The agent dashboard's four tiles plus the CSAT card, in one response.

    Separate from `OverviewReportSerializer` because the audience is different:
    every figure here is about **the caller**, and the endpoint is reachable by
    an agent, whereas the four manager reports are manager-or-admin only.

    Each of the first four numbers has a matching queue filter, named in the
    field comments below, so a dashboard tile and the queue its link opens
    cannot disagree — a tile whose count differs from the list it opens is
    worse than no tile at all.
    """

    # ?assignee=<me>&status=<open statuses>
    my_open = serializers.IntegerField()
    # ?assignee=<me>&due_within_minutes=60
    breaching_within_hour = serializers.IntegerField()
    # ?unassigned=true&department_code=<my department>
    unassigned_in_department = serializers.IntegerField()
    # ?assignee=<me>&resolved_after=<today 00:00>
    resolved_by_me_today = serializers.IntegerField()

    awaiting_first_reply = serializers.IntegerField()
    already_breached = serializers.IntegerField()
    csat_average = serializers.FloatField(allow_null=True)
    csat_count = serializers.IntegerField()
    csat_distribution = CSATBucketSerializer(many=True)
