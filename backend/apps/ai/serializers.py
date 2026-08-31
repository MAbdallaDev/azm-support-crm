"""AI request and response shapes.

Typed so drf-spectacular describes them; story 07's AI panel reads this schema.
"""

from rest_framework import serializers


class AIRequestSerializer(serializers.Serializer):
    ticket = serializers.IntegerField(help_text="Ticket id.")


class SuggestReplyRequestSerializer(AIRequestSerializer):
    context = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Optional note from the agent for the draft to incorporate.",
    )


class SummarizeResponseSerializer(serializers.Serializer):
    ticket = serializers.IntegerField()
    backend = serializers.CharField()
    summary = serializers.CharField()


class SuggestReplyResponseSerializer(serializers.Serializer):
    ticket = serializers.IntegerField()
    backend = serializers.CharField()
    # Not persisted anywhere. The agent edits this and sends it through story
    # 04's messages endpoint, which is what keeps "an agent always approves"
    # true rather than aspirational.
    suggested_reply = serializers.CharField()
    language = serializers.CharField()


class CategorizeResponseSerializer(serializers.Serializer):
    ticket = serializers.IntegerField()
    backend = serializers.CharField()
    category_id = serializers.IntegerField(allow_null=True)
    category_slug = serializers.CharField(allow_blank=True)
    confidence = serializers.FloatField()
    rationale = serializers.CharField()


class SuggestedSolutionItemSerializer(serializers.Serializer):
    ticket_id = serializers.IntegerField()
    number = serializers.CharField()
    subject = serializers.CharField()
    resolution = serializers.CharField(allow_blank=True)
    resolved_at = serializers.CharField(allow_blank=True)


class SuggestedSolutionsResponseSerializer(serializers.Serializer):
    ticket = serializers.IntegerField()
    backend = serializers.CharField()
    solutions = SuggestedSolutionItemSerializer(many=True)
