// Public Firebase Web app settings. Never put account passwords or service-account keys here.
export const firebaseWebConfig = {
  apiKey: 'AIzaSyCMbt-fX5wJuO37sPLQTx1bMq189i-jW-s',
  authDomain: 'hoho-event-game.firebaseapp.com',
  projectId: 'hoho-event-game',
  storageBucket: 'hoho-event-game.firebasestorage.app',
  messagingSenderId: '165336589519',
  appId: '1:165336589519:web:b0b7607f8cc476acea43ba',
  databaseURL: 'https://hoho-event-game-default-rtdb.asia-southeast1.firebasedatabase.app/'
};

export const config = {
  // Keep local demo mode until the database URL has been provided.
  firebase: firebaseWebConfig.databaseURL ? firebaseWebConfig : null,
  twitchUrl: 'https://www.twitch.tv/',
  emulators: false
};
