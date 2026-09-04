ALTER TABLE public.bets DROP COLUMN IF EXISTS pick_id;
ALTER TABLE public.bets DROP COLUMN IF EXISTS selection;
ALTER TABLE public.bets DROP COLUMN IF EXISTS stake_percent;
ALTER TABLE public.bets ALTER COLUMN user_id DROP NOT NULL;

DELETE FROM public.user_roles WHERE role = 'admin';
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'jg2345621@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;