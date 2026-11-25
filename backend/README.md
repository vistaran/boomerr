## Domain Monitoring Tool – Backend (Laravel)

Backend API for the Domain Monitoring Tool. It provides authentication (Sanctum + hCaptcha + optional Google), multi-company tenancy, domain management, notification integrations, and real-time updates via Laravel Reverb.

### Tech
- Laravel 12, PHP 8.2+
- Sanctum API tokens
- Laravel Reverb (private channels) for real-time events
- SQLite (default) or any Laravel-supported DB

### Multi-company model
- Users can belong to many workspaces via the pivot table `company_users (workspace_id, user_id, role_id)`.
- Roles live in `roles` (owner, admin, member). Seeded by `RolesSeeder`.
- All company-scoped endpoints require the header: `X-Company-ID: <workspace_id>` and will verify membership via the pivot before proceeding.
- Real-time events broadcast to private channel `company.{id}`; auth accepts listeners who belong to that company.

### Key endpoints (all paths are prefixed with `/api`)
- Auth
	- POST `/register` → returns `{ token, user, workspaces }` (hCaptcha required)
	- POST `/login` → returns `{ token, user, workspaces }` (hCaptcha required)
	- POST `/auth/google` → returns `{ token, user, workspaces }`
	- POST `/logout`
- workspaces
	- GET `/workspaces` → list workspaces for current user
	- POST `/workspaces` → create a company, attaching current user as owner
- Domains (requires `X-Company-ID`)
	- GET `/domains` → list domains for the selected company
	- POST `/domains` → create a domain in the selected company
- Integrations (requires `X-Company-ID`)
	- GET `/company/integrations` → `{ primary_contact_email, discord_webhooks, slack_webhooks }`
	- PUT `/company/integrations` → update company-level settings (e.g. primary email)
	- POST `/integrations/webhooks` → add a Discord/Slack webhook `{ type: 'discord'|'slack', name, url }`
	- DELETE `/integrations/webhooks/{id}` → remove webhook
	- POST `/integrations/channels/{id}/test` → send a test notification

### Environment variables
Copy `.env.example` to `.env` and set at least:
- Database (SQLite default works):
	- `DB_CONNECTION=sqlite`
	- `DB_DATABASE=./database/database.sqlite`
- Sanctum / App:
	- `APP_URL=http://localhost:8000`
- Reverb (WebSocket):
	- `REVERB_APP_ID=app-id`
	- `REVERB_APP_KEY=SomeKey`
	- `REVERB_APP_SECRET=SomeSecret`
	- `REVERB_HOST=localhost`
	- `REVERB_PORT=8080`
- hCaptcha:
	- `HCAPTCHA_SECRET_KEY=your-secret`
- Google Sign-In (optional):
	- `GOOGLE_CLIENT_ID=...`
	- `GOOGLE_CLIENT_SECRET=...`

Config keys added in `config/services.php`:
- `hcaptcha.secret`
- `google.client_id`, `google.client_secret`

### Setup (development)
1) Install dependencies and generate app key
	 - `composer install`
	 - `php artisan key:generate`
2) Run migrations and seed roles
	 - `php artisan migrate`
	 - `php artisan db:seed --class=RolesSeeder`
3) Start HTTP server and queues (you can also use the provided Composer `dev` script or run individually)
	 - `php artisan serve`
	 - `php artisan queue:listen`
	 - Start Reverb server if configured

### Notes
- Broadcasting auth is defined in `routes/channels.php` and checks membership via `$user->workspaces()->where('workspaces.id', $workspaceId)->exists()`.
- Many-to-many relationships live on `User::workspaces()` and `Company::users()`; pivot model is `CompanyUser`.

