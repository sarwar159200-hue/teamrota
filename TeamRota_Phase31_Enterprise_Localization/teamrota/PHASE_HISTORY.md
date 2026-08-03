# TeamRota Phase History


---

# TeamRota Phase 10 — Safe Email Decisions

This patch prevents Resend/network/provider failures from crashing leave and overtime approval/rejection actions.

## Behaviour
- Leave submitted: manager/approver/HOD notified; HR copied.
- Leave approved: employee and HR notified separately.
- Leave rejected: employee notified only.
- Overtime approved: employee and HR notified separately.
- Overtime rejected: employee notified only.
- Email failures are logged and never break the page.
- Server actions redirect cleanly after decisions, preventing client-side exception screens.

## Important Resend test limitation
`TeamRota <onboarding@resend.dev>` is for testing and normally sends only to the email address associated with the Resend account. Verify a domain you own for delivery to all employee and HR addresses.

No SQL migration is required.


---

# TeamRota Phase 11 — Annual Rota, Leave Limits and Performance

## Included

- Public Holiday removed from the employee leave-request list.
- Leave submission blocks requests above the available balance.
- Pending requests are reserved when checking available balance.
- Overlapping pending/approved leave requests are blocked.
- Working-day leave is calculated from rota, rotation and holiday data.
- HR/Admin can view every active employee in Annual Rota.
- Managers can view themselves and direct reports.
- Employees can view their own full-year rota.
- Annual Rota now includes a daily table with date, weekday, month, status, shift and details.
- Batch signed URLs replace sequential document-link calls.
- Database indexes added for rota and leave performance.

## Deployment

1. Run `supabase/phase11_rota_leave_performance.sql` once in Supabase SQL Editor.
2. Upload this complete release folder to GitHub.
3. Set the Vercel Root Directory to the folder containing `package.json`.
4. Redeploy without the existing build cache.


---

# TeamRota Phase 12 — HR Authority & Monthly Timesheets

Run only `supabase/phase12_timesheets_hr_authority.sql` after earlier migrations.

New Vercel variables (optional but recommended):
- `PAYROLL_NOTIFICATION_EMAIL` — payroll recipient
- `CRON_SECRET` — optional secret for cron endpoint

Phase 12 includes HR access to all rota records, monthly employee timesheets, manager approval, HR completion/payroll workflow, month-end email reminders, join date fields, Miran branding, employee/manager/approver identity, and admin/HR rota overrides.


## Phase 12 Revision 2

- Fixed PostgreSQL enum policy checks by casting `app_role` to text before using `lower()`.
- Leave submission now routes only to the employee's reporting line: Line Manager first, Leave Approver second, Department Head fallback.
- HR is not copied on initial submission and cannot bypass the manager-stage approval.
- After manager approval, HR and the employee are notified according to the configured workflow.
- Administrator retains override authority.


---

# TeamRota Phase 13 — Intelligent HR Authority

Phase 13 automatically treats employees as HR when their job title contains recognized HR terminology.

Recognized examples include:

- HR
- HR Officer / HR Manager / HR Supervisor
- Human Resource / Human Resources
- Human Capital
- People & Culture / People and Culture
- Personnel

## Permissions

A recognized HR employee receives workforce-management access equivalent to the HR application role, including all-employee rota, annual rota, timesheets, leave, overtime, holidays, employee updates, and notification diagnostics.

Admin-only functions remain Admin-only, including creating employee login accounts and creating organization structure items.

## Upgrade order

1. Run `supabase/phase13_intelligent_hr_authority.sql` once in Supabase SQL Editor.
2. Upload this complete Phase 13 folder to GitHub.
3. Set Vercel Root Directory to the folder that directly contains `package.json`.
4. Redeploy without build cache.

The SQL is idempotent and can safely be run again.


---

# TeamRota Phase 14 Revision 2

## Included

- Admin or the originally assigned Line Manager can amend an already approved or rejected leave decision.
- Approved-to-rejected amendments restore the deducted leave balance.
- Rejected-to-approved amendments validate and deduct the available balance.
- Every amendment requires a reason and is recorded in `leave_decision_audit`.
- Employee receives an email after every amendment.
- HR receives an email when an amendment changes the request to approved.
- English/Kurdish (Sorani) language selector is available globally.
- Kurdish mode switches the interface to RTL and translates the main application navigation, forms, dashboards, rota, leave, overtime, notifications and timesheet terminology.

## Upgrade order

1. Run `supabase/phase14_leave_amendment_i18n.sql` once in Supabase SQL Editor.
2. Upload this complete project folder to GitHub.
3. Set Vercel Root Directory to the folder that directly contains `package.json`.
4. Redeploy without build cache.


---

# TeamRota Phase 14 — Premium Navigation & Profile Readability

## Delivered

- Fixed profile names inheriting browser visited-link colors.
- Profile name is now high-contrast white and the job title uses a readable muted tone.
- Added truncation and tooltips for long names and job titles.
- Added a role badge beneath the profile identity.
- Improved profile photo/avatar size, border and contrast.
- Redesigned the sidebar with enterprise-grade hover, focus and active states.
- Improved icon/text alignment, spacing and navigation readability.
- Added responsive two-column mobile navigation and a one-column fallback.
- Added stronger keyboard focus behavior and accessible profile/navigation labels.
- Improved dashboard card interactions and spacing.
- Added My Timesheets to the normal employee KPI area.

## No SQL migration required

Phase 14 is a presentation and usability release. Do not run a new SQL file.

## Recommended remaining roadmap

1. Centralized reusable application shell so every page uses the same sidebar and header.
2. In-app notification center with unread counters.
3. Configurable permission matrix rather than role checks embedded in pages.
4. Payroll export formats such as Excel/CSV and monthly batch export.
5. Audit-trail viewer for sensitive HR and Admin actions.
6. Automated tests for leave, overtime, rota and timesheet workflows.
7. Error boundaries and user-friendly success/error messages after form submissions.
8. Pagination and server-side filtering for large employee directories.
9. SSO/MFA and stronger production security controls.
10. Accessibility audit and mobile navigation drawer.


---

# TeamRota Phase 15 — Arabic, Secure Admin Accounts & Dotted Reporting

## Included

- Fixed language selector at a stable top-right position.
- English, Kurdish Sorani and Arabic interface modes.
- RTL layout support for Kurdish and Arabic.
- Admin-only employee account creation.
- Admin visibility of registered email addresses.
- Admin ability to set a new temporary password with show/hide control.
- Passwords are never stored or displayed in plain text. Supabase Auth does not permit retrieving an existing password.
- Secondary or functional reporting relationships.
- Dotted reporting relationships appear in the organization chart and do not replace the primary line manager.

## Database upgrade

Run only:

`supabase/phase15_arabic_admin_dotted_reporting.sql`

The migration is safe to rerun.

## Deployment

Upload the complete Phase 15 folder. Set the Vercel Root Directory to the directory that directly contains `package.json`, then redeploy without build cache.


---

# TeamRota Phase 16 — Historical Leave and Annual Carry-Forward

## Included
- Admin and HR can record approved past leave for any active employee.
- Historical entries update leave balances, rota views and monthly timesheets.
- Normal balance, overlap, gender and document requirements still apply.
- Annual Leave carries a maximum of 5 unused days to the next year.
- Carried Annual Leave expires on 31 May of the new year if unused.
- Sick Leave carry-forward remains governed by its existing policy.

## Upgrade
Run `supabase/phase16_historical_leave_annual_carryover.sql`, upload the project and redeploy without build cache.


---

# TeamRota Phase 17 — Historical Rota Control & Manager Succession

## Features

- Admin and HR can bulk-create past rota history for one employee or all active employees.
- Bulk statuses include ON, OFF, Annual Leave, Sick Leave, Remote, Travel, Training and Public Holiday.
- Admin and HR can delete historical manual rota entries by employee and date range.
- Every bulk history action is recorded in `rota_history_audit`.
- When an active manager is changed to Inactive or Suspended, direct reports automatically move to that manager's own manager.
- Pending leave and overtime approvals are reassigned to the same next-level manager.

## Gmail sender change

Update these existing Vercel variables; do not create duplicates:

```env
SMTP_USER=miranenergyrotaplan@gmail.com
SMTP_PASS=NEW_GOOGLE_APP_PASSWORD_FOR_THIS_ACCOUNT
EMAIL_FROM=Miran Energy Rota Plan <miranenergyrotaplan@gmail.com>
```

Keep `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, and your HR/Payroll recipient variables.
After saving, redeploy without build cache.

## Database upgrade

Run only:

`supabase/phase17_historical_rota_manager_succession.sql`


---

# TeamRota Phase 18 — Leave History Cleanup, Premium UI and Performance

## Included
- Administrator-only permanent removal of leave-history records.
- Automatic restoration of used leave balance when an approved balance-deducting record is removed.
- Attachment cleanup and immutable deletion audit snapshot.
- Premium leave-history cards and safer destructive-action confirmation.
- Query limits, batched document signing and database indexes for faster loading.

## Upgrade
Run `supabase/phase18_leave_cleanup_performance_ui.sql`, upload this folder, set Vercel Root Directory to this folder, and redeploy without build cache.


---

# TeamRota Phase 19 — Hybrid Google Drive Archive

## Architecture
- Supabase PostgreSQL: live application data.
- Supabase Storage: active profile photos and leave attachments.
- Google Drive: approved leave-document archive, completed timesheets, payroll copies and future backups.
- Vercel: public assets and server application.

## Google Drive folder structure
- TeamRota Documents / Employees / [Employee] / Leave Documents / [Year]
- TeamRota Documents / Employees / [Employee] / Timesheets / [Year]
- TeamRota Documents / Payroll / [Year] / [Month]

## Required Vercel variables
- GOOGLE_DRIVE_CLIENT_ID
- GOOGLE_DRIVE_CLIENT_SECRET
- GOOGLE_DRIVE_REFRESH_TOKEN
- GOOGLE_DRIVE_ROOT_FOLDER_ID
- GOOGLE_DRIVE_ACCOUNT_EMAIL=miranenergyrotaplan@gmail.com

Run `supabase/phase19_hybrid_google_drive_archive.sql` once.


---

# TeamRota Phase 20 — Holiday Ranges & Visual Dotted Reporting

## Included

- Public/company holidays automatically display as PH for employees who would otherwise work that date.
- Existing weekend/rest days remain OFF/R instead of being overwritten by PH.
- Manual Admin rota overrides remain authoritative and can intentionally set ON/OFF on a holiday.
- Holiday creation supports From and To dates.
- Admin and HR can edit, activate/deactivate, or permanently delete a complete holiday period.
- Public/company holidays are always organization-wide. Department and location holidays remain scoped.
- Secondary reporting relationships are now drawn as real purple dotted connector lines on the organization chart, while the text label remains for clarity/accessibility.

## Upgrade

1. Run `supabase/phase20_holiday_ranges_visual_dotted_lines.sql` in Supabase SQL Editor.
2. Upload this full project folder to GitHub.
3. Set Vercel Root Directory to the folder that directly contains `package.json`.
4. Redeploy without build cache.

## Notes

A multi-day holiday is stored as one row per calendar date sharing the same `series_id`. This preserves compatibility with the rota, annual rota, timesheet and dashboard queries while allowing the period to be edited/deleted as one record.


---

# TeamRota Phase 20 Revision 2

## Added

- Highly visible language selector with UK, Kurdistan Region and Iraq flags.
- Responsive flag-only mode on smaller screens.
- Leave approval emails now contain a direct button and clickable URL to TeamRota Leave Requests.
- Overtime approval emails now contain a direct button and clickable URL to TeamRota Overtime Requests.
- Timesheet approval emails now contain a direct button and clickable URL to TeamRota Timesheets.

## Database

No additional SQL is required beyond the original Phase 20 migration.


---

# TeamRota Phase 21 — Unified Rota Status Engine

## Included fixes

- Active public/company holidays now replace generated annual-plan working assignments with `PH`.
- Explicit Admin/HR manual overrides still remain above holidays.
- Approved leave appears using the exact leave type code (AL, SL, MAT, PAT, ML, BL, UL, NB).
- Approved overtime appears in the rota cell as an `OT Xh` badge without hiding the employee's primary day status.
- The same unified logic is used by Workforce Rota Planner and Annual Rota Planner.
- Annual monthly summaries include approved overtime hours.
- UTC-safe date formatting prevents one-day shifts.

## Status priority

1. Approved leave
2. Explicit Admin/HR manual override
3. Generated annual pattern / employee rotation / standard weekday schedule
4. Public/company holiday replaces a scheduled working day
5. Approved overtime is shown as an additional badge

## Database

No new SQL migration is required if Phase 20 SQL was already run.

## Vercel root directory

Use the folder that directly contains `package.json`:

`TeamRota_Phase21_Unified_Rota_Holiday_Leave_Overtime`


---

# TeamRota Phase 22

## Included
- Login email placeholder changed to “Type your email address”.
- Admin/HR overtime edit and delete controls; employees may edit/delete only their own pending requests.
- Overtime change audit table.
- Organization chart uses service-role reads and includes disconnected/cyclic employees in an “Unassigned reporting” branch.
- Rota/timesheet statuses standardized to ON for working and OFF for weekends/rest.
- Landscape monthly timesheet print layout with employee, manager, approver, HR auditor, status, submitted date, daily status row and overtime row.
- Month-end timesheet readiness emails with direct TeamRota link.
- Workflow: Employee submits → Manager reviews → HR audits → HR sends to Payroll/marks done → Google Drive archive.

## Install
Run `supabase/phase22_timesheet_overtime_orgchart.sql`, then deploy the complete Phase 22 folder.

## Timesheet status flow
`draft → submitted → manager_approved → hr_done → done`

When HR selects **Send to Payroll**, the payroll email is sent, the month is marked `done`, and the finalized CSV is archived to Google Drive.


---

# TeamRota Phase 23 — Language Scroll & Workforce Leave Balances

## Changes

- The language selector is no longer fixed to the viewport. It remains at the top of the page and scrolls out of view naturally.
- Admin and HR users can view current-year leave balances for every active employee.
- The workforce balance table shows entitlement, used days, carry-forward, adjustment and remaining balance by leave type.
- HR recognition continues to support both the `hr` application role and HR/Human Resources job titles.

## Database

No SQL migration is required for Phase 23.


---

# TeamRota Phase 24 — Secure Password, Warm Welcome & Premium Design

## Included
- Reliable employee self-service password change with current-password verification.
- Clear success/error messages without crashing the page.
- Password visibility controls and strength guidance.
- Warm personalized welcome after successful login.
- Premium profile and security page redesign.
- Enhanced card depth, spacing, focus states and responsive behavior.

## Database migration
No new SQL migration is required.

## Security note
Passwords remain managed by Supabase Auth and are never stored in the public profiles table or displayed to administrators.


---

# TeamRota Phase 25 — AI HR Assistant

## Included
- Floating multilingual assistant in English, Kurdish Sorani and Arabic.
- Secure server-side OpenAI Responses API integration.
- Answers grounded in the signed-in employee's own live TeamRota data.
- Optional OpenAI vector-store file search for approved HR policies and FAQs.
- Direct TeamRota links for leave, overtime, rota and timesheets.
- Automatic fallback to Line Manager, HR or Admin when evidence is missing.
- No access to passwords, secrets, medical-document contents or other employees' private data.
- Optional audit log table.

## Required Vercel variables

```env
OPENAI_API_KEY=your_server_side_openai_api_key
OPENAI_MODEL=gpt-5-mini
TEAMROTA_APP_URL=https://teamrota-one.vercel.app
```

Optional approved-policy knowledge base:

```env
OPENAI_VECTOR_STORE_ID=vs_xxxxxxxxx
```

Keep `OPENAI_API_KEY` server-side. Never use `NEXT_PUBLIC_OPENAI_API_KEY`.

## SQL
Run `supabase/phase25_ai_hr_assistant.sql` once. The chatbot will still work without the audit table, but chat logs will not be recorded.

## Knowledge base
Create an OpenAI vector store, upload only approved HR documents, and place the vector-store ID in Vercel. Do not upload passwords, medical certificates, API keys or confidential employee files.

## Security model
Phase 25 retrieves live information only for the authenticated employee. Managers and HR do not receive cross-employee private data through chat. Formal HR, payroll, disciplinary, legal and medical decisions are escalated to HR.


---

# TeamRota Phase 26 — Automatic Leave Balances and HR Contact

## Included

- Repairs missing leave balances for every existing active employee.
- Automatically creates current-year and next-year balances for every future active employee.
- Recalculates balances when employee gender/status or leave-type entitlement settings change.
- The Leave page provisions missing balances before rendering.
- The AI assistant provisions missing balances before answering balance questions.
- HR escalation email changed to `reza.kamil@taurusenergy.com`.
- The Contact HR button opens a direct email to Reza Kamil.

## Installation

Run `supabase/phase26_leave_balance_auto_provision_hr_contact.sql` in Supabase SQL Editor, then deploy the complete project.

Optional Vercel variable:

`TEAMROTA_HR_CONTACT_EMAIL=reza.kamil@taurusenergy.com`

The application defaults to this address even when the variable is absent.


---

# TeamRota Phase 27 — Friendly Leave Validation

## Fix included

Submitting a leave request that overlaps an existing pending or approved request no longer produces a full server-side application error page.

The Leave page now displays a readable message:

> You already have a pending or approved leave request covering one or more of the selected dates. Please review your Leave History or choose different dates.

Other common leave submission issues are also shown inside the page, including:

- insufficient leave balance;
- invalid date ranges;
- requests crossing two leave years;
- periods containing no eligible working days;
- missing required supporting documents;
- document upload failures.

Successful submissions display a confirmation message.

## Deployment

No new SQL migration is required.

Upload the complete `app27` folder to GitHub and use the Vercel Root Directory:

`app27`


---

# TeamRota Phase 28 — Visible Flags, Urdu and Broader AI Assistant

## Included
- Replaced text abbreviations with visible flag artwork: UK, Kurdistan Region, Iraq and Pakistan.
- Added Urdu as a fourth interface and chatbot language.
- Added Urdu translations for the main navigation, workforce, leave, rota, timesheet and login labels. Untranslated specialist labels safely remain in English.
- Added Urdu chatbot text and direct-data recognition for leave balance, line manager, leave, overtime and timesheets.
- Expanded the AI instructions so it answers safe general workplace and TeamRota questions, while keeping company-specific data grounded in authorized live data and approved HR documents.
- Company-specific answers that cannot be confirmed are referred to the Line Manager, HR or Admin instead of being invented.

## Required Vercel variables
- OPENAI_API_KEY
- OPENAI_MODEL (for example the model already configured for this project)
- TEAMROTA_APP_URL=https://teamrota-one.vercel.app
- TEAMROTA_HR_CONTACT_EMAIL=reza.kamil@taurusenergy.com

For company policy answers, configure OPENAI_VECTOR_STORE_ID with approved HR documents.

## Deployment
Upload the folder `app28` and set Vercel Root Directory to `app28`. No new SQL is required.


---

# Phase 29 — Workforce Availability & Bulk Historical Leave

## New capabilities

- Every authenticated employee can open `/availability` to see who is available, off, on leave, or observing a public holiday today.
- Confidential leave reasons are not shown on the availability page.
- Admin and HR can add up to 100 separate historical leave dates for one employee in one submission.
- Supported bulk date formats: `YYYY-MM-DD`, `DD-MMM-YYYY`, and `DD/MM/YYYY`.
- Each date becomes an individual approved leave record and updates leave balance, rota, annual rota, and timesheets.
- Duplicate dates, future dates, OFF/rest dates, public holidays, and insufficient balances are validated before insertion.

## Database

No new SQL migration is required. The release uses the existing leave, rota, holiday, and balance tables.


---

# TeamRota Phase 5

Run `supabase/phase5_annual_rota_leave.sql` after Phase 4.

## Email
Set Vercel variables: `RESEND_API_KEY`, `EMAIL_FROM`, and `HR_NOTIFICATION_EMAIL`. Verify the sender domain in Resend. Review `overtime_notification_log` for sent, failed, or skipped delivery status.

## New pages
- `/year-rota` annual ON/OFF generation and yearly totals
- `/leave` leave balances, carry-forward and requests


---

# TeamRota Phase 6

Phase 6 adds:
- Gender-driven maternity, paternity and nursing eligibility
- Nursing Break only after approved maternity leave and within one year
- Private medical-document upload for sick leave
- Leave submission emails to line manager and HOD, with HR copied
- Decision emails to employee and HR
- Role-sensitive, clickable dashboard KPIs
- Organization chart photos, emails and phone numbers
- Self-service employee profile photos
- HR/Admin employee photo and gender management

## Upgrade
1. Run `supabase/phase6_hr_profile_notifications.sql` after Phase 5.
2. Upload this project to GitHub.
3. Set Vercel Root Directory to the folder containing this `package.json`.
4. Confirm Vercel variables: `RESEND_API_KEY`, `EMAIL_FROM`, `HR_NOTIFICATION_EMAIL`.
5. Redeploy without build cache.
6. In People & Structure, set each employee gender, line manager, leave approver, department and HOD.

Email delivery requires a verified sender domain in Resend. Delivery results are stored in `leave_notification_log`.


---

# TeamRota Phase 7 Corrective Release

This release fixes the Phase 6 employee form layout, adds a separate employee directory, expandable/minimizable organization chart, editable employee profile/settings, password renewal, show/hide temporary passwords, flexible rota date ranges, manager team rota visibility, printable monthly/yearly rota, holiday precedence in rota, and supporting-document links for authorized leave reviewers.

## Required SQL
Run `supabase/phase7_usability_directory_rota.sql` after Phase 6.

## Email configuration
Email cannot be delivered until all of these are added in Vercel and the project is redeployed:
- `RESEND_API_KEY`
- `EMAIL_FROM` using a Resend-verified sender/domain
- `HR_NOTIFICATION_EMAIL`

Your screenshot showed only Supabase variables, so email delivery was disabled. After configuration, inspect `leave_notification_log` and `overtime_notification_log` for `sent`, `failed`, or `skipped` results.


---

# TeamRota Phase 8 — Approval Email Routing Fix

This patch changes decision notifications for both Overtime and Leave:

- Approved: Employee receives an individual email; every configured HR recipient receives a separate individual email.
- Rejected: Employee receives an individual email only.
- HR recipients are resolved from active profiles whose role is HR (case-insensitive), plus `HR_NOTIFICATION_EMAIL`.
- Each recipient is sent and logged separately so one invalid or restricted address cannot block all other recipients.
- No database migration is required.

Important Resend testing limitation:
`onboarding@resend.dev` can deliver only to the email address associated with the Resend account. A verified custom domain is required to deliver to other employee/HR addresses.


---

# TeamRota Phase 9 – Leave Submission Email Routing Fix

This patch makes leave notification routing match the approved business workflow:

- Submission: Line Manager, configured Leave Approver, and Head of Department receive separate approval emails; active HR recipients and `HR_NOTIFICATION_EMAIL` are copied.
- Approval: employee and HR receive separate notification emails.
- Rejection: employee only.
- Recipient resolution uses the Supabase admin client to avoid RLS-related missing manager fields.
- A diagnostic `submitted_no_approver` log entry is created when no manager/approver/HOD email is configured.

No SQL migration is required.


## Phase 30 — Professional Organization Chart & Standard Rotations
- Redesigned organization chart with professional employee cards, search, department filtering, zoom controls, fit-to-screen, cleaner hierarchy connectors, and visible functional/dotted reporting lines.
- Added standard rotation templates: 7/7, 14/14, 28/28, 42/14, and full-time Sunday–Thursday.
- Full-time rotation follows fixed weekdays: Friday and Saturday are weekends regardless of cycle anchor.
- HR and Admin can install, assign, amend, and manually override rotation schedules.
- Run `supabase/phase30_professional_orgchart_standard_rotations.sql` once.
