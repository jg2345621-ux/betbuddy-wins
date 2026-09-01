CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'free',
  league text NOT NULL DEFAULT '',
  match text NOT NULL DEFAULT '',
  market text NOT NULL DEFAULT '',
  odds numeric NOT NULL DEFAULT 1.9,
  stake text NOT NULL DEFAULT '2% bankroll',
  confidence integer NOT NULL DEFAULT 7,
  roi numeric NOT NULL DEFAULT 0,
  analysis text NOT NULL DEFAULT '',
  event_time text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.picks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.picks TO authenticated;
GRANT ALL ON public.picks TO service_role;

ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active picks" ON public.picks
FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins read all picks" ON public.picks
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert picks" ON public.picks
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update picks" ON public.picks
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete picks" ON public.picks
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_picks_updated_at BEFORE UPDATE ON public.picks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.picks (type, league, match, market, odds, stake, confidence, roi, analysis, event_time, verified) VALUES
('vip','NBA','Lakers vs Warriors','Lakers -4.5',1.92,'2% bankroll',9,18.4,'LeBron descansado, Curry con molestia de tobillo. El modelo XSAAC detecta value del 12% sobre la línea.','Hoy 20:30',true),
('vip','NFL','Chiefs vs Bills','Over 51.5',1.87,'2% bankroll',9,22.1,'Clima perfecto en Arrowhead, defensas agotadas. Históricamente 68% over en este matchup.','Hoy 19:00',true),
('free','UFC','Topuria vs Holloway','Topuria ML',1.75,'1% bankroll',7,8.2,'Topuria con striking superior. Value moderado para free.','Mañana 21:00',true),
('vip','MLB','Yankees vs Dodgers','Yankees ML',2.05,'2.5% bankroll',10,19.7,'Cole vs pitcher novato. Yankees 9-1 en sus últimos 10 con Cole en casa.','Hoy 18:10',true),
('free','Liga MX','América vs Tigres','BTTS Sí',1.80,'1% bankroll',6,5.4,'Ambos equipos con la ofensiva encendida.','Hoy 21:00',false),
('vip','Champions','Real Madrid vs City','City DNB',1.95,'2% bankroll',9,16.9,'Bajas importantes en el Madrid. El modelo marca edge +14%.','Mañana 14:00',true);