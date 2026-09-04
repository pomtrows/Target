-- ============================================================
-- Script de création de la table `projects` pour Target
-- À exécuter dans la console Supabase (SQL Editor)
-- ============================================================

-- 1. Création de la table projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile TEXT NOT NULL DEFAULT 'perso',
  name TEXT NOT NULL,
  category_id TEXT,
  description TEXT DEFAULT '',
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),
  status TEXT NOT NULL DEFAULT '0-Non lancé' CHECK (status IN ('0-Non lancé', '1-En cours', '2-Terminé')),
  start_date DATE,
  end_date DATE,
  attachments JSONB DEFAULT '[]'::JSONB,
  objective_ids JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour optimiser les performances de requêtage par utilisateur et profil
CREATE INDEX IF NOT EXISTS idx_projects_user_profile ON public.projects(user_id, profile);

-- 2. Sécurité Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Politique d'accès : chaque utilisateur a les pleins pouvoirs sur ses propres projets
DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
CREATE POLICY "Users can manage their own projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Ajout optionnel de la colonne project_id sur la table objectives
ALTER TABLE public.objectives 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
