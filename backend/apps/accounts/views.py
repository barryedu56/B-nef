from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.common.throttling import ScopedRateThrottle

from .models import PasswordResetCode
from .serializers import (
    AvatarUploadSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .services import generate_reset_code, send_reset_email

User = get_user_model()


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Connexion — throttlée pour empêcher un essai en masse de mots de passe."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class AvatarView(APIView):
    """Photo de profil : upload (multipart) ou suppression."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = AvatarUploadSerializer(instance=request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        old = request.user.avatar
        serializer.save()
        if old and old.name != request.user.avatar.name:
            old.delete(save=False)
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def delete(self, request):
        if request.user.avatar:
            request.user.avatar.delete(save=True)
        return Response(UserSerializer(request.user, context={"request": request}).data)


def _find_user(identifier: str):
    identifier = (identifier or "").strip()
    if not identifier:
        return None
    return User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()


class PasswordResetRequestView(APIView):
    """Demande un code de réinitialisation.

    Renvoie toujours le même message générique (compte introuvable ou pas
    d'e-mail enregistré ne sont pas distingués côté client) pour ne pas
    révéler quels comptes existent.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _find_user(serializer.validated_data["identifier"])
        if user and user.email:
            code = generate_reset_code(user)
            send_reset_email(user, code)
        return Response(
            {
                "detail": "Si ce compte existe et a une adresse e-mail enregistrée, "
                "un code de réinitialisation vient d'être envoyé."
            }
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data
        user = _find_user(v["identifier"])
        reset_code = None
        if user:
            reset_code = (
                PasswordResetCode.objects.filter(user=user, code=v["code"], used_at__isnull=True)
                .order_by("-created_at")
                .first()
            )
        if not user or not reset_code or not reset_code.is_valid():
            raise ValidationError({"detail": "Code invalide ou expiré."})

        user.set_password(v["new_password"])
        user.save(update_fields=["password"])
        reset_code.used_at = timezone.now()
        reset_code.save(update_fields=["used_at"])
        # les autres codes en attente pour ce compte sont invalidés aussi
        PasswordResetCode.objects.filter(user=user, used_at__isnull=True).delete()

        return Response({"detail": "Mot de passe mis à jour."}, status=status.HTTP_200_OK)
