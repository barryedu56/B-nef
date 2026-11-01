"""Connexion sans tenir compte des majuscules dans le nom d'utilisateur :
sur téléphone, le clavier met souvent la première lettre en majuscule
(« Amadou » au lieu de « amadou ») et la connexion échouait."""
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class CaseInsensitiveUsernameBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if username is None or password is None:
            return None
        # Le nom exact d'abord : d'anciens comptes peuvent ne différer que par
        # les majuscules (l'inscription l'interdit désormais).
        user = User._default_manager.filter(username=username).first()
        if user is None:
            matches = list(User._default_manager.filter(username__iexact=username)[:2])
            user = matches[0] if len(matches) == 1 else None
        if user is None:
            # Même temps de réponse qu'avec un vrai compte : on ne trahit pas
            # quels noms existent.
            User().set_password(password)
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
