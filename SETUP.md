# Setup

This app is a static site (hosted on GitHub Pages) that talks directly to a
free Firebase project for shared, real-time data - so when someone adds or
edits an item on their phone, it appears on everyone else's phone
immediately. You only need to do this Firebase setup once.

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com and sign in with any Google
   account.
2. Click **Add project**, give it a name (e.g. `kelsey-archive`), and finish
   the wizard (you can decline Google Analytics, it's not needed).

## 2. Create the Firestore database

1. In the left sidebar: **Build > Firestore Database**.
2. Click **Create database**.
3. Choose a location close to where the archive is (this can't be changed
   later).
4. Start in **production mode** (we'll set proper rules below).

## 3. Set up the shared team PIN

The app shows a single PIN screen before anyone can see or edit archive
data - there are no individual logins, everyone uses the same PIN. Under
the hood this is one shared Firebase account whose password is the PIN.

1. **Authentication > Get started** (or **Sign-in method** if you're already
   there).
2. Under **Sign-in method**, enable **Email/Password**.
3. Go to the **Users** tab > **Add user**.
4. Email: `team@kelsey-archive.app` (this must match `SHARED_AUTH_EMAIL` in
   `js/app.js` exactly - it's never used to send mail, it just names the
   account). Password: your PIN, at least 6 characters (Firebase's minimum).
5. If **Anonymous** sign-in is enabled from earlier testing, turn it off
   (Sign-in method tab) - it's not used any more and leaving it on would let
   someone bypass the PIN.

**Changing the PIN later:** Authentication > Users > select the user > the
⋮ menu > **Reset password**, or delete and re-add the user.

## 4. Set Firestore security rules

**Build > Firestore Database > Rules**, replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**. This means: only someone who has entered the correct PIN
in the app (and so is signed into the shared account) can read or write
archive items - the PIN screen is the actual security boundary, not just a
UI nicety.

## 5. Register the web app and get your config

1. Project settings (gear icon) > **Your apps** > web icon `</>`.
2. Give it a nickname (e.g. `Kelsey Archive Web`), you don't need Firebase
   Hosting since we're using GitHub Pages.
3. Copy the `firebaseConfig` object it shows you.
4. Open `js/firebase-config.js` in this repo and paste the values in,
   replacing the placeholders. This file is not secret - it just tells the
   app which Firebase project to talk to; the rules above are what actually
   secure the data.
5. Commit and push `js/firebase-config.js`.

## 6. Enable GitHub Pages

1. On GitHub: repo **Settings > Pages**.
2. Source: **Deploy from a branch**, branch **main**, folder **/(root)**.
3. Save. The site will be live at
   `https://wolfpunk25.github.io/Kelsey-Archive/` within a minute or two.

## 7. First data load

Once the site is live and `js/firebase-config.js` has real values, open the
site, go to the **Upload** tab, choose the archive spreadsheet, pick
**Add to existing data** (the database starts empty, so add/replace behave
the same the first time), and upload.

## Adding a new zone later

The floor plan for each zone lives in `js/zones.js`. To add a new zone:

1. Get the new zone's layout as a PDF (same style as the original plan).
2. Send it back to Claude (or measure the bay rectangles yourself) to get
   precise coordinates, and add a new entry to the `ZONES` object in
   `js/zones.js` following the same shape as `C`.
3. Commit and push - no other code changes are needed, the zone picker and
   add-item form pick up new zones automatically.

## Installing as an app (PWA)

- **iPhone (Safari):** open the site, tap Share, **Add to Home Screen**.
- **Android (Chrome):** open the site, tap the ⋮ menu, **Install app** (or
  you'll get an automatic "Add to Home screen" banner).
