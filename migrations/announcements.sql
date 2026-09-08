-- Migration: announcements table (2026-09-08)
-- Admin-managed notices shown at the top of the home page.
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city text NOT NULL DEFAULT 'all',               -- 'all' or a city slug e.g. 'tamale'
    title text NOT NULL,
    body text NOT NULL,
    announcement_type text NOT NULL DEFAULT 'info', -- info | promo | alert
    link_url text,
    is_active boolean NOT NULL DEFAULT true,
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz,
    sort_order int NOT NULL DEFAULT 0,
    created_date timestamptz NOT NULL DEFAULT now(),
    updated_date timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active announcements" ON announcements;
CREATE POLICY "Public can read active announcements" ON announcements
    FOR SELECT USING (
        is_active = true
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at >= now())
    );

DROP POLICY IF EXISTS "Admins manage announcements" ON announcements;
CREATE POLICY "Admins manage announcements" ON announcements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND account_type = 'admin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND account_type = 'admin')
    );

INSERT INTO public.announcements (city, title, body, announcement_type, sort_order)
VALUES ('all', '📲 Get the Android App!',
        'Tamale Market Finder is now available as an Android app. Install it to browse markets with one tap — faster, full-screen, and built for Ghana.',
        'promo', 1)
ON CONFLICT DO NOTHING;
