# TeamRota

TeamRota is a multilingual workforce management platform for employee administration, organization structure, rota planning, holidays, leave, overtime, timesheets, email workflows, Google Drive archiving, and an AI HR assistant.

## Main modules

- Employee directory and organization chart
- Primary and dotted reporting lines
- Live workforce availability
- Annual and short-range rota planning
- Public and company holidays
- Leave requests, balances, historical leave, and bulk historical dates
- Overtime approval and timesheet integration
- Monthly timesheet workflow: Employee → Manager → HR → Payroll → Google Drive archive
- English, Kurdish Sorani, Arabic, and Urdu interfaces
- Gmail SMTP notifications
- Supabase authentication, database, and active-document storage
- Google Drive archive for finalized records
- OpenAI-powered HR assistant with HR escalation

## Deployment

The folder containing `package.json` is the application root.

Vercel settings:

```text
Framework: Next.js
Root Directory: leave empty when files are at repository root
Build Command: npm run build
Install Command: npm install
Output Directory: default
```

## Phase 29 additions

- All employees can view today’s workforce availability at `/availability`.
- Admin and HR can upload up to 100 separate historical leave dates in one operation.
- Each historical date is validated and saved as an individual approved record.

See `README_PHASE29_AVAILABILITY_BULK_HISTORY.md` for details.
