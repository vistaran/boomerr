## Domain Monitoring Tool – Frontend (React + Vite)

React + TypeScript client for the Domain Monitoring Tool.

### Dev setup
1) Install deps: `npm install`
2) Create `.env` with:
  - `VITE_HCAPTCHA_SITE_KEY=...`
  - `VITE_GOOGLE_CLIENT_ID=...` (optional)
3) Run: `npm run dev`

### Notes
- Auth stores `dm_token`, `dm_user`, `dm_workspaces`, and the active company `dm_active_company` in localStorage.
- The API client automatically adds `Authorization: Bearer <token>` and `X-Company-ID` headers when present.
- Company Switcher in the header lets you change the active company; the Overview and Integrations pages will reflect that.

