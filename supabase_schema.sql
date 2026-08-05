-- 1. Create users table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  "passwordHash" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  avatar JSONB,
  preferences JSONB DEFAULT '{"fitPreference": "regular", "paletteFirst": true}'::jsonb
);

-- Enable RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile." ON public.users;
CREATE POLICY "Users can view their own profile."
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.users;
CREATE POLICY "Users can update their own profile."
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.users;
CREATE POLICY "Users can insert their own profile."
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);


-- 2. Create garments table
CREATE TABLE IF NOT EXISTS public.garments (
  id TEXT PRIMARY KEY,
  "userId" UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  zone TEXT NOT NULL,
  dye JSONB NOT NULL,
  season TEXT NOT NULL,
  material TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  seed TEXT NOT NULL,
  status TEXT NOT NULL,
  "taskId" TEXT,
  "inPalette" BOOLEAN NOT NULL,
  "wornCount" INTEGER DEFAULT 0,
  "addedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for garments
ALTER TABLE public.garments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own garments." ON public.garments;
CREATE POLICY "Users can CRUD their own garments."
  ON public.garments FOR ALL
  USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");


-- 3. Create fits table
CREATE TABLE IF NOT EXISTS public.fits (
  id TEXT PRIMARY KEY,
  "userId" UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "garmentIds" TEXT[] NOT NULL,
  note TEXT,
  "savedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for fits
ALTER TABLE public.fits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own fits." ON public.fits;
CREATE POLICY "Users can CRUD their own fits."
  ON public.fits FOR ALL
  USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");


-- 4. Automatically create public.users profile on Auth Signup via Postgres Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, preferences)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'name', 'Atelier Member'),
    '{"fitPreference": "regular", "paletteFirst": true}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name);
  RETURN new;
END;
$$;

-- Attach Trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
