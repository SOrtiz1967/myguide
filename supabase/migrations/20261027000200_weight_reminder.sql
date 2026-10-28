-- Spec 016: preferencia «recordarme pesarme». Solo un ajuste del perfil propio; sin notificaciones push.

alter table public.profiles add column weight_reminder boolean not null default false;

grant update (weight_reminder) on public.profiles to authenticated;
