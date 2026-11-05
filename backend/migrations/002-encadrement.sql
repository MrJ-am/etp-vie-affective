BEGIN;
ALTER TABLE comptes ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'participant' CHECK (role IN ('participant','encadrant'));
ALTER TABLE comptes ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;
ALTER TABLE comptes ADD COLUMN IF NOT EXISTS nom text;
ALTER TABLE comptes ADD COLUMN IF NOT EXISTS prenom text;
ALTER TABLE comptes ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS comptes_email_unique ON comptes (email) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS groupes (
  id uuid PRIMARY KEY,
  encadrant uuid NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  nom text NOT NULL CHECK (length(nom) BETWEEN 1 AND 160),
  archive boolean NOT NULL DEFAULT false,
  invitation text NOT NULL UNIQUE CHECK (length(invitation)=64)
);
-- Une inscription appartient à un groupe ; les anciens comptes restent autonomes.
CREATE TABLE IF NOT EXISTS membres (
  compte uuid PRIMARY KEY REFERENCES comptes(id) ON DELETE CASCADE,
  groupe uuid NOT NULL REFERENCES groupes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS membres_groupe ON membres(groupe);
CREATE TABLE IF NOT EXISTS seances (
  id integer PRIMARY KEY CHECK (id BETWEEN 0 AND 14),
  contenu jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS visibilites (
  groupe uuid NOT NULL REFERENCES groupes(id) ON DELETE CASCADE,
  seance integer NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  visible boolean NOT NULL DEFAULT true,
  PRIMARY KEY(groupe,seance)
);
CREATE TABLE IF NOT EXISTS supports (
  id uuid PRIMARY KEY,
  seance integer NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  nom text NOT NULL,
  pdf bytea NOT NULL CHECK (octet_length(pdf) BETWEEN 12 AND 2000000)
);
CREATE TABLE IF NOT EXISTS questionnaires (
  id uuid PRIMARY KEY,
  groupe uuid NOT NULL REFERENCES groupes(id) ON DELETE CASCADE,
  titre text NOT NULL,
  questions jsonb NOT NULL,
  compteurs jsonb NOT NULL,
  ouvert boolean NOT NULL DEFAULT true,
  reponses integer NOT NULL DEFAULT 0
);
-- Aucun choix, texte libre, ordre ou horodatage individuel n'est enregistré.
CREATE TABLE IF NOT EXISTS participations (
  questionnaire uuid NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  compte uuid NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  PRIMARY KEY(questionnaire,compte)
);
INSERT INTO schema_migrations(version) VALUES (2) ON CONFLICT DO NOTHING;
COMMIT;
