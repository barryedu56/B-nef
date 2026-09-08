from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from rest_framework import serializers

from apps.common.phone import clean_guinea_phone
from apps.currencies.models import Currency

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    effective_display_currency = serializers.CharField(
        source="effective_display_currency_id", read_only=True
    )
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "phone",
            "language",
            "avatar",
            "base_currency",
            "display_currency",
            "effective_display_currency",
        )
        read_only_fields = ("id", "username")

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url

    def validate_phone(self, value):
        return clean_guinea_phone(value)


class AvatarUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("avatar",)

    def validate_avatar(self, value):
        max_size = 5 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("L'image ne doit pas dépasser 5 Mo.")
        return value


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    base_currency = serializers.PrimaryKeyRelatedField(
        queryset=Currency.objects.filter(is_active=True), required=False
    )
    email = serializers.EmailField(
        required=True,
        help_text="Sert à réinitialiser le mot de passe en cas d'oubli.",
    )

    class Meta:
        model = User
        fields = ("id", "username", "email", "phone", "password", "base_currency", "language")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exclude(email="").exists():
            raise serializers.ValidationError("Un compte utilise déjà cette adresse e-mail.")
        return value

    def validate_phone(self, value):
        return clean_guinea_phone(value)

    def create(self, validated_data):
        password = validated_data.pop("password")
        if not validated_data.get("base_currency"):
            validated_data["base_currency"] = Currency.objects.filter(
                code=settings.DEFAULT_BASE_CURRENCY
            ).first()
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(help_text="Nom d'utilisateur ou e-mail.")


class PasswordResetConfirmSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
