# Déploiement sur OVH

L'application a besoin d'un serveur **Node.js 22+** (rendu serveur et fonctions serveur) :
un VPS OVH convient. Un hébergement mutualisé sans Node.js ne suffit pas.

## Build

```sh
npm ci
npm run build:node   # produit .output/ (serveur Node autonome)
npm start            # écoute sur PORT (3000 par défaut)
```

Seul le dossier `.output/` est nécessaire en production. Placez un reverse proxy HTTPS
(nginx) devant : le cookie de session administrateur est marqué `secure`.

## Variables d'environnement (serveur)

| Variable | Rôle |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase (Lovable Cloud) |
| `SUPABASE_PUBLISHABLE_KEY` | clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role : **secrète**, jamais côté navigateur |
| `SESSION_SECRET` | secret aléatoire d'au moins 32 caractères (cookie admin) |
| `ADMIN_PASSWORD` | mot de passe de l'espace administrateur |
| `PORT`, `HOST` | port et interface d'écoute du serveur Node |

Les variables `VITE_SUPABASE_*` du fichier `.env` sont lues au moment du build.

## Connexion par lien e-mail

Dans les réglages d'authentification du backend (Lovable Cloud > Users / Auth) :

1. activer la connexion par lien magique (e-mail) ;
2. ajouter le domaine OVH (ex. `https://desk.nova-serenity.fr/**`) aux URL de redirection
   autorisées, sinon le lien renvoie vers l'URL par défaut du projet ;
3. configurer le domaine d'envoi des e-mails si vous voulez un expéditeur à votre nom.

## Base de données

La migration `drizzle/migrations/0001_secure_access_magic_link.sql` doit être appliquée
avant de mettre en ligne cette version.
