# TeamRota

Enterprise HR, leave, rota, overtime, timesheet, organization-chart and AI-assistant platform for Miran Energy.

## Main capabilities

- Employee and organization management
- Primary and dotted reporting lines
- Annual and live rota planning
- Public/company/department/location holidays
- Leave balances, approvals, historical leave and carry-forward
- Overtime requests and approvals
- Monthly timesheets and payroll workflow
- Email notifications
- Google Drive archive integration
- AI HR Assistant
- English, Kurdish Sorani, Arabic and Urdu support
- Supabase authentication, database and storage
- Next.js deployment on Vercel

## Required Vercel settings

- Framework preset: `Next.js`
- Root Directory: leave empty when these files are uploaded directly to the repository root
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: leave empty/default

## Important environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
HR_NOTIFICATION_EMAIL=
PAYROLL_NOTIFICATION_EMAIL=
TEAMROTA_HR_CONTACT_EMAIL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
TEAMROTA_APP_URL=https://teamrota-one.vercel.app
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
GOOGLE_DRIVE_ACCOUNT_EMAIL=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

Secrets must remain server-side and must never use the `NEXT_PUBLIC_` prefix.

## Database

For an existing TeamRota database, run only the migration files that have not already been applied. Do not rerun the complete schema unless creating a new database.
