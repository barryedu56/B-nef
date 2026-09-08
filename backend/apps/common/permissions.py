from rest_framework import permissions


class IsOwner(permissions.BasePermission):
    """N'autorise que le propriétaire de l'objet.

    L'objet doit exposer soit `owner`, soit un chemin vers l'utilisateur
    via `get_owner()`.
    """

    def has_object_permission(self, request, view, obj):
        owner_id = getattr(obj, "owner_id", None)
        if owner_id is None and hasattr(obj, "get_owner"):
            owner = obj.get_owner()
            owner_id = getattr(owner, "id", None)
        return owner_id == request.user.id
