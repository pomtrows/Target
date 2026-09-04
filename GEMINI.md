# Instructions du Projet Target

## Règles Git & Gestion des Branches (STRICT)

### 1. Branche de travail systématique : `preprod`
- Tout développement, correction de bug, refactorisation ou ajout de fonctionnalité doit être réalisé, commité et poussé **exclusivement sur la branche `preprod`** (`origin/preprod`).
- L'assistant doit toujours s'assurer d'être sur la branche `preprod` (`git checkout preprod`) avant de commiter ou pousser des changements.
- Dès qu'un développement est effectué, commiter et pusher les modifications sur `origin/preprod` automatiquement.

### 2. Branche de production : `main` (STRICTEMENT PROTÉGÉE)
- **Ne JAMAIS commiter ni pusher directement sur `main`** sans demande explicite.
- La branche `main` ne doit être mise à jour (par merge, rebase ou push) **UNIQUEMENT lorsque l'utilisateur le demande expressément** (exemples : *"mets en prod"*, *"merge sur main"*, *"pousse sur main"*).
