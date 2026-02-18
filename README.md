# Resume Builder

Template-driven static resume builder with live preview, optional sections, JSON save/load, print/PDF export, Google login, and Firebase cloud sync.

## Run locally

```bash
python3 -m http.server 4173
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173)

## Current features

- All major resume sections are addable (`+ Add`) and removable
- Sections can be shown/hidden from `Section Visibility`
- Collapsed editor groups by default (`Edit` / `Close`) for compact workspace
- Sticky live preview while editing
- Configurable LinkedIn logo link in header
- Clickable links in content (URLs + `[label](url)` format)
- Font scale controls for fitting content
- JSON export/import for resume data
- Google sign-in via Firebase Auth
- Per-user cloud save/load via Firestore
- Print/PDF layout tuned for A4

## Firebase setup (Google Auth + Firestore)

1. Create a Firebase project.
2. Enable Authentication:
   - Firebase Console -> `Authentication` -> `Sign-in method` -> enable `Google`.
3. Create Firestore database:
   - Firebase Console -> `Firestore Database` -> create in production mode (or test mode while developing).
4. Add your deployed domain:
   - Authentication -> Settings -> Authorized domains -> add your GitHub Pages domain.
5. Add Firebase web app config in `index.html` before `script.js`:

```html
<script>
  window.FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_APP_ID"
  };
</script>
```

6. Firestore data path used by this app:
   - `users/{uid}/resumes/default`

### Example Firestore rules (starter)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/resumes/{resumeId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Deploy to GitHub Pages

1. Create a GitHub repo and push this folder.
2. In GitHub: `Settings` -> `Pages`.
3. Under `Build and deployment`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` (or your default branch), folder `/ (root)`
4. Save. GitHub will publish a URL like:
   `https://<username>.github.io/<repo>/`

No build step is needed because this is a static HTML/CSS/JS app.
