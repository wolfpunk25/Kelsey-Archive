// 1. Copy this file to js/firebase-config.js
// 2. Paste the config object from Firebase Console > Project settings >
//    General > Your apps > SDK setup and configuration.
// 3. Commit js/firebase-config.js as normal. This is a static site with no
//    build step or server, so this file has to be published for the app to
//    work at all - that's fine, a Firebase web config is not a secret; it
//    just identifies which project to talk to. Access is controlled by the
//    Firestore security rules in SETUP.md, not by hiding this file.

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD7os3J1eJuBbZBdVBQiG1UDOsM3hCyVvA',
  authDomain: 'kelsey-archive.firebaseapp.com',
  projectId: 'kelsey-archive',
  storageBucket: 'kelsey-archive.firebasestorage.app',
  messagingSenderId: '229772541025',
  appId: '1:229772541025:web:c43e0cd5f3439343ac7e20'
};
