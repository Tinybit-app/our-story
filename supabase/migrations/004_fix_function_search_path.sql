-- Fix mutable search_path security advisory on all SECURITY DEFINER functions.
-- SET search_path = '' forces fully-qualified names and prevents search_path injection.
-- Table names are unquoted so Postgres folds them to lowercase, matching stored names.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  full_name TEXT;
  space_pos INT;
BEGIN
  full_name := TRIM(NEW.raw_user_meta_data->>'full_name');
  space_pos := POSITION(' ' IN full_name);

  INSERT INTO public.user (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN space_pos > 0 THEN LEFT(full_name, space_pos - 1) ELSE full_name END,
    CASE WHEN space_pos > 0 THEN SUBSTR(full_name, space_pos + 1) ELSE NULL END,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.handle_new_account_storage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.accountstorage (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_my_family_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT family_id FROM public.familymember WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_family_ids_as_role(required_roles TEXT[])
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT family_id FROM public.familymember
  WHERE user_id = auth.uid() AND role = ANY(required_roles);
$$;
