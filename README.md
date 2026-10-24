# LifeAdmin — Personal Document Organizer with OCR and Expiry Reminders

LifeAdmin is a full-stack personal document management platform that reads identity and insurance documents via OCR, suggests expiry dates, securely stores files encrypted at rest, and sends automated reminder alerts before documents expire.

---

## Tech Stack
- **Frontend:** React (Vite), Tailwind CSS v4, React Router, Axios, Lucide Icons, IBM Plex Sans font.
- **Backend:** Node.js, Express (REST API).
- **Database:** MongoDB with Mongoose & MongoDB GridFS for persistent encrypted file chunks.
- **Authentication:** JWT (JSON Web Tokens) with `bcryptjs` password hashing.
- **File Encryption:** Node.js built-in `crypto` using authenticated **AES-256-GCM**.
- **OCR Engine:** `tesseract.js` with `sharp` image preprocessing and `pdf-parse` for text-based PDFs.
- **Date & Category Detection:** `chrono-node` + regular expressions for Indian (`DD/MM/YYYY`) and ISO dates.
- **Email Delivery:** Brevo (Sendinblue) Transactional HTTPS API (`fetch`).
- **Reminders & Scheduling:** Built-in `node-cron` daemon + external webhook endpoint (`/api/reminders/run`) for sleeping servers.
- **Security:** Helmet (with custom CSP), CORS, input validation, and domain typo detection.

---

## Features
1. **Authentication & Profile Security**:
   - Register, login, and `/forgot-password` flow.
   - Input format validation and 14 common domain typo rejections (e.g., `gamil.com`, `outlok.com` -> *"Did you mean gmail.com?"*).
2. **Auto-Scan & OCR Expiry Detection**:
   - Drag-and-drop upload for JPG, PNG, and PDF (up to 10 MB).
   - Sharp preprocessing (downscales images above 1600px for 512 MB memory constraints, grayscale, contrast normalization).
   - Detects expiry keywords (*"Valid Upto"*, *"Date of Expiry"*, *"Valid Till"*, etc.) while filtering out issue dates and dates of birth.
   - Category guessing (Passport, Licence, Insurance, RC, etc.) and OCR confidence rating.
3. **Confirm-Before-Save Interface**:
   - Pre-populated editable form to review Title, Category, Document Number, and Expiry Date.
   - Collapsible raw OCR text inspection drawer.
4. **Cryptographic Vault with MongoDB GridFS**:
   - Every file is encrypted using AES-256-GCM (with unique IV and authentication tag) before storage.
   - Encrypted file bytes are stored directly inside MongoDB GridFS, surviving Render free-tier restarts without relying on ephemeral disks.
   - On-the-fly streaming decryption only when authorized owners view or download their files.
5. **Dashboard & Analytics**:
   - 4 primary metric cards: Total Documents, Safe Documents, Expiring Soon (<= 30 days), Expired.
   - Urgent Action Required list and visual category distribution bars.
6. **Document Vault**:
   - Search by title, document number, or extracted OCR text.
   - Category filter pills and expiry sorting.
   - Document detail page with decrypted in-browser preview (PDF iframe / image) and metadata editing.
7. **Automated Reminders**:
   - Checks documents expiring in 30, 7, and 1 days.
   - Deduplication tracking (`remindersSent`) to prevent duplicate emails.
   - Webhook trigger `POST /api/reminders/run` protected with `x-cron-secret`.

---

## Limitations
- **OCR Accuracy**: OCR accuracy depends heavily on scan clarity, resolution, lighting, and document condition. Users must always verify the detected expiry date in the confirm step before saving.
- **Encryption at Rest vs Server Processing**: Files are encrypted at rest with AES-256-GCM. During the initial upload, the server temporarily holds the file buffer in memory to perform OCR and date parsing before encrypting and writing to GridFS.

---

## Local Development Setup

### 1. Prerequisites
- Node.js >= 20.0.0
- MongoDB installed locally or a free MongoDB Atlas cluster connection string.

### 2. Environment Setup
Create a `.env` file inside `server/` (or copy `server/.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/lifeadmin
JWT_SECRET=super_secret_jwt_key_lifeadmin_development
ENCRYPTION_KEY=c7a6e12e3e57fbf02a498b8c25381669d0d34360e23846db44a60c681cfd8a24
BREVO_API_KEY=
MAIL_FROM=
CRON_SECRET=dev_cron_secret
CLIENT_URL=http://localhost:5173
```

### 3. Install & Run
From the root directory:
```bash
# Run server and client in development mode
npm run server   # Starts Express backend on port 5000 (with nodemon)
npm run client   # Starts Vite frontend on port 5173
```
Or run the full test suite:
```bash
npm test
```

---

## Deployment to Render (Free Tier as ONE Web Service)

This application is architected to deploy as a **single unified web service** on Render: Express serves both the REST API at `/api/*` and the compiled React production bundle from `client/dist`.

### Step 1: Set Up MongoDB Atlas
1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Under **Network Access**, add IP `0.0.0.0/0` (Allow access from anywhere).
3. Under **Database Access**, create a user with read/write privileges.
4. Copy your connection string: `mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/lifeadmin?retryWrites=true&w=majority`.

### Step 2: Set Up Brevo for Transactional Emails
1. Sign up for a free account at [brevo.com](https://www.brevo.com) (allows 300 free emails/day).
2. Go to **SMTP & API** -> **API Keys** -> Generate a new API key.
3. Verify your sender email under **Senders & IP**.

### Step 3: Deploy on Render
1. Push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Select **Node** environment and configure:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
5. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGO_URI`: `your_mongodb_atlas_connection_string`
   - `JWT_SECRET`: `secure_random_string_min_32_chars`
   - `ENCRYPTION_KEY`: `64_character_hex_string` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `BREVO_API_KEY`: `your_brevo_api_key`
   - `MAIL_FROM`: `your_verified_sender_email`
   - `CRON_SECRET`: `random_secret_for_cron_job`
6. Click **Deploy Web Service**.

---

### Step 4: Keep Sleeping Server Active & Run Daily Reminders (cron-job.org)
Render's free tier spins down web services after 15 minutes of inactivity. To ensure your server wakes up and dispatches daily expiry reminders reliably:

1. Create a free account at [cron-job.org](https://cron-job.org).
2. Create a **New Cronjob**:
   - **Title:** `LifeAdmin Daily Reminders`
   - **URL:** `https://your-app-name.onrender.com/api/reminders/run`
   - **Execution Schedule:** Every day at `23:00` (11:00 PM IST / Asia/Kolkata).
   - **Request Method:** `POST`
   - **Headers:** Add a custom request header:
     - Name: `x-cron-secret`
     - Value: `<your CRON_SECRET from Render env>`
3. Save the cron job.
4. (Optional) You can also create a lightweight ping job every 10 minutes pointing to `GET https://your-app-name.onrender.com/api/health` to keep the free-tier service warm during daytime hours.
