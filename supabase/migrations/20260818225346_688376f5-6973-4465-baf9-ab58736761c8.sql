CREATE TABLE public.bankroll_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  initial_bankroll NUMERIC NOT NULL DEFAULT 1000,
  stop_loss_pct NUMERIC NOT NULL DEFAULT 10,
  stop_win_pct NUMERIC NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bankroll_settings TO authenticated;
GRANT ALL ON public.bankroll_settings TO service_role;
ALTER TABLE public.bankroll_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.bankroll_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.bets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  event TEXT NOT NULL DEFAULT '',
  stake NUMERIC NOT NULL,
  odds NUMERIC NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('won','lost','void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bets_user_created_idx ON public.bets (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bets" ON public.bets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);