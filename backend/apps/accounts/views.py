from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
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

from .authentication import PasswordAwareTokenObtainPairSerializer, tokens_for

from .serializers import (
    AvatarUploadSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .services import check_reset_code, delete_account, generate_reset_code, send_reset_email, set_new_password

User = get_user_model()


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Connexion — throttlée pour empêcher un essai en masse de mots de passe.
    Les jetons portent l'empreinte du mot de passe (voir authentication.py)."""

    serializer_class = PasswordAwareTokenObtainPairSerializer
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
            if code is not None:  # sinon : trop de demandes récentes pour ce compte
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
        reset_code = check_reset_code(user, v["code"]) if user else None
        if reset_code is None:
            # Même message que le compte existe ou non.
            raise ValidationError(
                {"detail": "Code invalide ou expiré. Après 5 erreurs, le code est annulé : demandes-en un nouveau."}
            )
        _validate_new_password(v["new_password"], user)
        set_new_password(user, v["new_password"])
        reset_code.used_at = timezone.now()
        reset_code.save(update_fields=["used_at"])
        return Response({"detail": "Mot de passe mis à jour."}, status=status.HTTP_200_OK)


def _validate_new_password(password: str, user) -> None:
    # Validateurs Django avec le compte : refuse aussi un mot de passe trop
    # proche du nom d'utilisateur ou de l'e-mail.
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise ValidationError({"new_password": list(exc.messages)}) from exc


class ChangePasswordView(APIView):
    """Changer son mot de passe depuis l'app (ancien + nouveau). Coupe les
    sessions ouvertes ailleurs, et renvoie de nouveaux jetons pour que cet
    appareil-ci reste connecté."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        user = request.user
        if not user.check_password(request.data.get("current_password") or ""):
            raise ValidationError({"current_password": "Mot de passe actuel incorrect."})
        new_password = request.data.get("new_password") or ""
        if new_password == request.data.get("current_password"):
            raise ValidationError({"new_password": "Choisis un mot de passe différent de l'actuel."})
        _validate_new_password(new_password, user)
        set_new_password(user, new_password)
        return Response(tokens_for(user))


class DeleteAccountView(APIView):
    """Suppression définitive du compte, confirmée par le mot de passe."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        password = request.data.get("password") or ""
        if not request.user.check_password(password):
            raise ValidationError({"password": "Mot de passe incorrect."})
        delete_account(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
