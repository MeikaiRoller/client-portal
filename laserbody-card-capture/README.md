This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

This project defaults to Webpack dev mode (`next dev --webpack`) to avoid a known Windows Turbopack symlink privilege issue when using `mongodb`.
If you want to try Turbopack anyway, use:

```bash
npm run dev:turbo
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment variables

Create a `.env.local` in `laserbody-card-capture/` with:

```bash
ZENOTI_API_BASE=https://api.zenoti.com
ZENOTI_API_KEY=your_zenoti_api_key
DEFAULT_CENTER_ID=3d342ee5-d01f-48de-a72a-ae79df30d559

MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=your_database_name
MONGODB_AUTH_COLLECTION=auth_users
MONGODB_CLAIM_COLLECTION=auth_claim_sessions
MONGODB_ZENOTI_CACHE_COLLECTION=zenoti_cache

# Zenoti read-cache TTL (seconds)
ZENOTI_CACHE_TTL_SECONDS=900

# OTP claim flow
CLAIM_OTP_DEV_MODE=false
CLAIM_OTP_EXPIRES_MINUTES=10
OTP_FROM_EMAIL=no-reply@your-domain.com
OTP_EMAIL_SUBJECT=Your LaserbodyMD verification code
RESEND_API_KEY=your_resend_api_key
```

The login API expects users in Mongo with at least:

- `email` or `email_normalized`
- `password_hash` in `scrypt$N$r$p$salt$hexDigest` format
- optional profile fields: `phone`, `first_name`, `last_name`, `zenoti_guest_id`, `zenoti_center_id`
- optional household links: `linked_profiles: [{ zenoti_guest_id, zenoti_center_id?, relationship? }]`

### Claim / Register flow

If a user exists in Zenoti but not in Mongo auth, they can claim their account from the login page:

1. Enter Zenoti email
2. System matches profile(s) from Zenoti
3. OTP verification
4. Set password and create Mongo auth record

OTP delivery behavior:

- `CLAIM_OTP_DEV_MODE=true` returns `otp_dev_code` in API response (local testing only)
- `CLAIM_OTP_DEV_MODE=false` sends real OTP email through Resend
- Requires `RESEND_API_KEY` and `OTP_FROM_EMAIL` when dev mode is false

API routes:

- `POST /api/auth/claim/start`
- `POST /api/auth/claim/complete`

`support_required_duplicate` resolution is returned when exact duplicate records are found and should be resolved by customer support.

### Zenoti API usage controls

- Dashboard reads are cached server-side in Mongo (`MONGODB_ZENOTI_CACHE_COLLECTION`) with TTL (`ZENOTI_CACHE_TTL_SECONDS`).
- Dashboard also keeps a browser session cache to prevent repeated refresh calls.
- On new login, cache is refreshed only when stale/expired; otherwise cached data is reused.
- Future writes (phone/email/payment updates) should explicitly call Zenoti and then invalidate related cache keys.

### Seed an auth user

Create or update an auth user with a generated `scrypt` hash:

```bash
npm run seed:auth -- --email jane@example.com --password "ChangeMe123!" --first Jane --last Doe --phone 6475551234
```

Optional Zenoti bindings:

```bash
npm run seed:auth -- --email jane@example.com --password "ChangeMe123!" --zenotiGuestId <guest_id> --zenotiCenterId <center_id>
```

Optional household relationship label:

```bash
npm run seed:auth -- --email jane@example.com --password "ChangeMe123!" --zenotiGuestId <guest_id> --zenotiCenterId <center_id> --relationship daughter
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


Brampton - 160 Main St S, Brampton, ON L6Y 1N2
Mississauga - 802 Southdown Rd Unit C3, Mississauga, ON L5J 2Y4
Don Mills - 15 Marie Labatte Rd, Toronto, ON M3C 0J1
Oakville - 2501 Prince Michael Drive C1, Oakville, ON L6H 0E9
Pickering - 375 Kingston Rd, Pickering, ON L1V 1A3
Richmond Hill - 11160 Yonge St #11, Richmond Hill, ON L4S 1K9
Hamilton - 101 Locke St S #6, Hamilton, ON L8P 4A6