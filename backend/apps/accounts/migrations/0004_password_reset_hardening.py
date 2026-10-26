from django.db import migrations, models


def drop_pending_codes(apps, schema_editor):
    # Les anciens codes étaient stockés en clair et durent 15 minutes au
    # plus : on les efface plutôt que de les convertir.
    apps.get_model("accounts", "PasswordResetCode").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_user_avatar"),
    ]

    operations = [
        migrations.RunPython(drop_pending_codes, migrations.RunPython.noop),
        migrations.RemoveIndex(model_name="passwordresetcode", name="accounts_pa_user_id_193f58_idx"),
        migrations.RemoveField(model_name="passwordresetcode", name="code"),
        migrations.AddField(
            model_name="passwordresetcode",
            name="code_hash",
            field=models.CharField(default="", max_length=64, verbose_name="empreinte du code"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="passwordresetcode",
            name="attempts",
            field=models.PositiveSmallIntegerField(default=0, verbose_name="essais ratés"),
        ),
        migrations.AlterField(
            model_name="passwordresetcode",
            name="used_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="utilisé / annulé le"),
        ),
        migrations.AddIndex(
            model_name="passwordresetcode",
            index=models.Index(fields=["user", "created_at"], name="accounts_pa_user_id_reset_idx"),
        ),
    ]
