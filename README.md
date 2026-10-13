# 🛡️ LifeAdmin - Personal Document Organizer & Expiry Reminders

A full-stack web application for organizing critical personal documents (passports, driving licences, vehicle RC, insurance policies, warranties, certificates) with **OCR text extraction**, **intelligent expiry date detection**, **AES-256-GCM encryption at rest**, and **automated email renewal reminders**.

---

## 🌟 Features

1. **Authentication & User Management**
   - User registration & login with secure password hashing via `bcryptjs`.
   - Stateless JWT tokens stored client-side with route protection middleware (`auth.middleware.js`).
   - `passwordHash` is never exposed in any API response.

2. **Drag-and-Drop Document Upload**
   - Supports **JPG, PNG, and PDF** files up to **10 MB**.
   - Strict format filtering and file size validation.

3. **OCR & Intelligent Expiry Detection**
   - **Tesseract.js** OCR with **Sharp** image pre-processing (grayscale conversion, contrast normalization, edge sharpening, upscaling).
   - Fast direct text extraction for digital PDFs via **pdf-parse**.
   - Expiry detection targeting keywords: `Date of Expiry`, `Valid Upto`, `Valid Till`, `Expires`, `Expiry`, `Renewal Date`, `Period of Insurance to`.
   - Ignores irrelevant dates such as Date of Birth (DOB) and Issue Date (DOI).
   - Falls back to the latest future date with low confidence indicator.
   - Built-in support for Indian date format (`DD/MM/YYYY`) and `chrono-node` natural language date parsing.
   - Automatic category guessing (Passport, Driving Licence, Insurance, Vehicle RC, Warranty, Certificate).

4. **Confirm-Before-Save Verification Form**
   - Review and edit the title, category, document number, and detected expiry date.
   - Displays OCR confidence badge: **High**, **Medium**, or **Low**.
   - Mandatory note: *"Please verify. OCR can make mistakes."*
   - Document is only encrypted and committed to the database upon user confirmation.

5. **Bank-Grade Encryption at Rest**
   - Built-in Node.js `crypto` with **AES-256-GCM** encryption.
   - Unique 16-byte IV and authentication tag prepended to each encrypted file on disk.
   - Files are decrypted on the fly only when the authenticated owner views or downloads them.
   - Strict resource ownership authorization on every document route.

6. **Interactive Dashboard**
   - Real-time statistics: Total documents, Expiring within 30 days, Expired, and Safe documents.
   - Color-coded status badges:
     - 🟢 **Green (Safe)**: More than 30 days remaining.
     - 🟠 **Orange (Expiring Soon)**: Expiring within 30 days.
     - 🔴 **Red (Expired)**: Past the expiry date.
   - Visual category distribution progress bars.
   - Urgent action list highlighting renewals needing immediate attention.

7. **Document Vault (Search, Filter, Sort)**
   - Live search across titles, category names, document numbers, and extracted OCR text.
   - Filter documents by category.
   - Sort documents by soonest expiry, latest expiry, recently uploaded, or alphabetically.
   - Single document detail page with:
     - Inline decrypted image / PDF preview.
     - Raw OCR text inspector.
     - Edit metadata form.
     - Decrypted file download.
     - Secure file deletion.

8. **Automated & Manual Email Reminders**
   - Automated daily cron schedule via `node-cron` running at midnight (`0 0 * * *`).
   - Checks documents expiring in **30, 7, and 1 days**.
   - Dispatches HTML reminder emails via `Nodemailer`.
   - Tracks sent intervals (`remindersSent: [30, 7, 1]`) to prevent duplicate emails.
   - Includes manual trigger endpoint (`POST /api/reminders/trigger`) and a "Test Reminders" button in the navigation bar.

9. **Polished Responsive UI & Dark Mode**
   - Built with React, Tailwind CSS, and Lucide icons.
   - Seamless Dark Mode toggle with preference persistence in `localStorage`.
   - Mobile-responsive navigation.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19 (Vite), Tailwind CSS v4, React Router v7, Axios, Lucide React |
| **Backend** | Node.js, Express.js (REST API) |
| **Database** | MongoDB with Mongoose (with embedded in-memory fallback) |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| **File Upload & Storage** | `multer` (memory buffer), AES-256-GCM encrypted disk storage |
| **OCR & Image Processing** | `tesseract.js`, `sharp`, `pdf-parse` |
| **Date Detection** | `chrono-node`, Custom Indian `DD/MM/YYYY` regex engine |
| **Email & Reminders** | `node-cron`, `nodemailer` (supports Ethereal test accounts & Gmail SMTP) |
| **Security Middleware** | `helmet`, `cors` |

---

## 📁 Folder Structure

```text
lifeadmin/
├── client/                     # React Frontend
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js        # Axios instance with JWT interceptor
│   │   ├── components/
│   │   │   ├── ExpiryBadge.jsx # OCR confidence pill
│   │   │   ├── Navbar.jsx      # Top navigation & dark mode toggle
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── StatusBadge.jsx # Expiry status badge (green, orange, red)
│   │   ├── context/
│   │   │   ├── AuthContext.jsx # Auth state & token storage
│   │   │   └── ThemeContext.jsx# Dark mode state & theme switcher
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── DocumentDetailPage.jsx
│   │   │   ├── DocumentsPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   └── UploadPage.jsx
│   │   ├── App.jsx             # React router configuration
│   │   ├── index.css           # Tailwind CSS imports
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Express Backend
│   ├── config/
│   │   └── db.js               # MongoDB connection + in-memory fallback
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── document.controller.js
│   │   └── reminder.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js  # JWT verification
│   │   ├── errorHandler.js     # Global Express error handler
│   │   └── upload.middleware.js# Multer memory storage & validation
│   ├── models/
│   │   ├── Document.js         # Document schema & virtuals
│   │   └── User.js             # User schema with secure toJSON
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── document.routes.js
│   │   └── reminder.routes.js
│   ├── scripts/
│   │   └── seed.js             # Demo data generator
│   ├── services/
│   │   ├── dateDetector.service.js # Regex & Chrono expiry parser
│   │   ├── encryption.service.js   # AES-256-GCM file cipher
│   │   ├── ocr.service.js          # Sharp + Tesseract + PDF parse
│   │   └── reminder.service.js     # Nodemailer & node-cron logic
│   ├── tests/
│   │   ├── dateDetector.test.js    # Unit tests for expiry logic
│   │   └── e2e.test.js             # Full API integration tests
│   ├── utils/
│   │   └── categoryKeywords.js     # Keyword classifier
│   ├── uploads/                    # Encrypted files (.enc)
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
├── package.json                # Root convenience scripts
└── README.md
```

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Node.js** (v18 or higher; tested on Node.js v24)
- **npm** (v9 or higher)

### 2. Environment Variables (.env)
The backend requires configuration in `server/.env`. A ready-to-use `.env` file is already generated, and an example is located at `server/.env.example`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/lifeadmin
JWT_SECRET=super_secret_jwt_key_lifeadmin_change_this_in_production
# 32-byte hex string (64 characters) for AES-256-GCM
ENCRYPTION_KEY=c7a6e12e3e57fbf02a498b8c25381669d0d34360e23846db44a60c681cfd8a24
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password
CLIENT_URL=http://localhost:5173
```

> **Zero-Setup Database Notice**: If you have a local MongoDB instance running at `mongodb://127.0.0.1:27017`, the app connects to it automatically. If MongoDB is not running, the backend automatically starts an embedded in-memory MongoDB engine (`mongodb-memory-server`) with zero external configuration required.

> **Zero-Setup Email Notice**: If placeholder email credentials are used, Nodemailer automatically creates a free **Ethereal test account** and logs preview URLs to the console.

---

### 3. Running the Application

From the root project folder `D:\Z\lifeadmin`:

#### Start Backend Server:
```bash
cd server
npm start
# Server starts on http://localhost:5000
```

#### Start Frontend Client (in a separate terminal):
```bash
cd client
npm run dev
# Frontend starts on http://localhost:5173
```

Alternatively, from the root folder:
```bash
npm run server  # starts backend
npm run client  # starts frontend
```

---

### 4. Optional: Populate Sample Demo Data

To instantly populate the app with realistic dummy documents (Passport, Driving Licence, Insurance, Vehicle RC) for testing:

```bash
cd server
npm run seed
```

This creates a demo account:
- **Email:** `demo@lifeadmin.local`
- **Password:** `Password123!`

---

### 5. Running the Automated Tests

LifeAdmin includes both **unit tests** (for OCR expiry detection across Passports, Driving Licences, and Insurance policies) and **end-to-end integration tests** (for authentication, upload, encryption, decryption, and stats):

```bash
cd server
npm test
```

Test Results Summary:
- 5 Unit tests passed: Passport OCR expiry, Driving Licence "Valid Upto", Insurance "Valid Till", and fallback date picking.
- 7 E2E tests passed: Health check, Registration, OCR upload & AES-256 encryption, Dashboard stats, File decryption streaming, Reminder trigger, and Deletion.

---

## 🔒 Security Architecture

1. **Passwords**: Hashed with `bcryptjs` using a salt work factor of 10. Passwords are never stored in plain text and `passwordHash` is excluded from all JSON serializations.
2. **File Encryption (AES-256-GCM)**:
   - When a user uploads a file, it is kept in memory, preprocessed, and scanned with OCR.
   - The file is immediately encrypted with **AES-256-GCM** before writing to `server/uploads/`.
   - The on-disk file payload contains: `[16-byte IV] + [16-byte Authentication Tag] + [Ciphertext]`.
   - The file is never stored in plain text on disk.
3. **Decryption on Demand**: Decryption occurs exclusively in memory when an authenticated user requests `GET /api/documents/:id/file`, strictly checking ownership against `req.user._id`.
4. **HTTP Protection**: Configured with `helmet` for secure HTTP headers and strict `cors` policies.

---

## ⚠️ Limitations & Disclaimers

1. **OCR is Not 100% Accurate**:
   - OCR performance depends on scan resolution, lighting, folds, and fonts.
   - Always inspect the **Confirm-Before-Save form** to verify the extracted expiry date and document number against the original physical document.
2. **Encryption-at-Rest vs. End-to-End Zero-Knowledge**:
   - LifeAdmin uses **encryption at rest (server-side)** with AES-256-GCM.
   - Because the server must perform OCR processing and automated daily reminder checks on expiry dates, the server possesses the encryption key (`ENCRYPTION_KEY` in `.env`).
   - This protects the files against unauthorized physical disk access or backup leaks, but it is not a zero-knowledge client-side encryption system where only the client holds the key.
3. **Email Delivery**:
   - In development mode without verified SMTP credentials, reminder emails are sent via Ethereal test inbox or logged as mock dispatches. For production emails, configure Gmail or SendGrid SMTP in `.env`.
