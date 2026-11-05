# Google Authentication & Cloud Database Security Plan (MDM Route Finder)

This update removes the insecure client-side PIN/passcode screen and replaces it with real **Google Sign-In (Firebase Authentication)** and **Cloud Firestore** security rules, ensuring only the authorized administrator (`shivamvk1090@gmail.com`) can add, edit, or delete school delivery data.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Addressing the Login Security Flaw**: Showing default PINs or passkeys on a login screen—or validating PINs purely in browser code—is a major security flaw because anyone inspecting the page can bypass it. By switching to **Google OAuth + Firebase Security Rules**, authentication is handled by Google's servers, and database write permissions are enforced in the cloud.

- **Confirmed Decision 1 (Strict Single-Admin Access)**: Only the verified Google account **`shivamvk1090@gmail.com`** will have permission to open the Admin Console, add new schools, edit existing school details, or import/reset data. Any other Google account that signs in will see an "Access Denied: Unauthorized Account" notice and remain in read-only mode.
- **Confirmed Decision 2 (Public Read-Only Map & Directory)**: Delivery drivers, route executives, and kitchen staff can view the 129 schools, filter routes, search by UDISE/SPOC, and use 1-tap calling & Google Maps navigation immediately **without** needing to log in.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Completely removes all hardcoded PINs, passkeys, and password hints from the UI and codebase.
  2. Integrates **Google Sign-In** (`signInWithPopup`) when clicking **Admin**, **Add School**, or **Edit**.
  3. Syncs the 129 Kanpur schools with **Cloud Firestore** so any edits or new schools added by `shivamvk1090@gmail.com` are permanently saved and reflected across all devices in real time.
- **Target Audience**:
  - **Public / Drivers / Field Staff**: Instant, zero-login access to school locations, routes, and 1-tap phone calls.
  - **Kitchen Administrator (`shivamvk1090@gmail.com`)**: Verified Google OAuth access to manage the school dataset and view the audit log.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Public View**: Opens directly into the 129 schools list and interactive Google Map. Edit icons on school cards are hidden for unauthenticated visitors to keep the mobile UI clean and prevent confusion (or gated behind the Google Sign-In prompt).
  2. **Admin Sign-In Flow**: Tapping **Admin** or **Add School** opens a clean **Google Authentication Modal** with a single **"Continue with Google"** button (no PIN inputs, no exposed credentials).
  3. **Email Verification Gate**:
     - If signed in as `shivamvk1090@gmail.com`, the header displays your verified profile badge, unlocks **Add School**, **Edit**, and **Admin Console**, and allows instant 1-click Sign Out.
     - If signed in with any other email, an explicit **"Unauthorized Email (`user@example.com`)"** alert is shown with a button to switch Google accounts.
- **Visual Identity & Theme**:
  - Retains the kitchen-warm dark green theme (`#111e17` background, `#16271e` cards, `#e8a33d` amber accents, `#7fb298` sage highlights) with responsive mobile bottom navigation.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Real Google OAuth (`signInWithPopup`) vs. Client-Side Passwords**
  - *Chosen Approach*: Firebase Authentication with Google Provider.
  - *Why*: Eliminates password management and makes credential guessing or front-end inspection impossible.
- **Decision 2: Cloud Firestore Persistence with Initial 129-School Auto-Seeding**
  - *Chosen Approach*: Store schools in Firestore (`/schools/{schoolId}`) and audit logs in (`/audit_logs/{logId}`), automatically seeding from the verified 129 Kanpur schools dataset if the cloud collection is empty.
  - *Why*: Ensures changes made by the admin on mobile or desktop are saved in a real database and enforced by server-side security rules checking `request.auth.token.email == "shivamvk1090@gmail.com" && request.auth.token.email_verified == true`.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MDM Route Finder (Client)                        │
├───────────────────────────────────┬─────────────────────────────────────┤
│   Public Read-Only Experience     │      Protected Admin Experience     │
│  • Live Search & Route Chips      │  • Google Sign-In Modal (OAuth)     │
│  • Interactive Google Map         │  • Email Gate: shivamvk1090@...     │
│  • 1-Tap SPOC/Driver Calling      │  • Add / Edit School Modal          │
│  • Google Maps Turn-by-Turn Nav   │  • Admin Console & CSV Export       │
└─────────────────┬─────────────────┴──────────────────┬──────────────────┘
                  │ Public Read (`get`, `list`)        │ Verified Admin Write
                  ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Firebase Backend (Auth + Firestore)                   │
│  • Firebase Auth: GoogleAuthProvider (`signInWithPopup`)                │
│  • Firestore Rules:                                                     │
│      - `allow read: if true;` on `/schools/{schoolId}`                  │
│      - `allow create, update, delete: if isAuthorizedAdmin();`          │
│        where `request.auth.token.email == 'shivamvk1090@gmail.com'`     │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **`schools` Collection**: Stores all 18 school attributes (`id`, `schoolName`, `udise`, `routeCode`, `nodeCode`, `routeName`, `lat`, `lon`, `driverName`, `driverContact`, `routeExecutive`, `routeExecutiveContact`, `address`, `pincode`, `spocName`, `spocContact`, `category`, `nodeGroup`, `nodeGroupName`).
  - **`audit_logs` Collection**: Tracks admin actions (`ADD_SCHOOL`, `EDIT_SCHOOL`, `DELETE_SCHOOL`, `IMPORT_DATA`, `RESET_DATA`) with server timestamps and admin email.
