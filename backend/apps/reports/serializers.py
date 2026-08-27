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


class VolumeReportSerializer(serializers.Serializer):
    days = serializers.IntegerField()
    by_status = BucketSerializer(many=True)
    by_priority = BucketSerializer(many=True)
    by_channel = BucketSerializer(many=True)
    by_day = BucketSerializer(many=True)


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
