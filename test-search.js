const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
try {
  // Read environment variables from .env.local
  const envPath = path.join(__dirname, '.env.local');
  let serviceAccountJson;
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const serviceAccountMatch = envContent.match(/FIREBASE_SERVICE_ACCOUNT='(.+)'/s);
    if (serviceAccountMatch) {
      serviceAccountJson = serviceAccountMatch[1];
    }
  }
  
  if (!serviceAccountJson && !process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('FIREBASE_SERVICE_ACCOUNT not found in .env.local or environment variables');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(serviceAccountJson || process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  // Simulate the search function logic
  async function testSearch() {
    try {
      const searchTerm = 'kelyan';
      const currentUserId = 'vT4zl0UqTaViGYesdtuKRuImiN63'; // The real user's ID
      
      console.log(`Testing search for "${searchTerm}" by user ${currentUserId}`);
      console.log('=' .repeat(60));
      
      const trimmedSearchTerm = searchTerm.trim();
      const usersRef = db.collection('users');
      const resultsMap = new Map();
      const SEARCH_LIMIT = 50;
      
      // Helper functions
      function isEmailAdmin(term) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(term);
      }
      
      function isPhoneNumberAdmin(term) {
        const phoneRegex = /^[\+]?[1-9]?[0-9]{7,15}$/;
        return phoneRegex.test(term.replace(/[\s\-\(\)]/g, ''));
      }
      
      function containsText(text, searchTerm) {
        if (!text || !searchTerm) return false;
        return text.toLowerCase().includes(searchTerm.toLowerCase());
      }
      
      function startsWithText(text, searchTerm) {
        if (!text || !searchTerm) return false;
        return text.toLowerCase().startsWith(searchTerm.toLowerCase());
      }
      
      function exactMatch(text, searchTerm) {
        if (!text || !searchTerm) return false;
        return text.toLowerCase() === searchTerm.toLowerCase();
      }
      
      function addUserToResults(docSnap, matchType, score) {
        const data = docSnap.data();
        const user = {
          uid: docSnap.id,
          name: data.name,
          username: data.username,
          email: data.email,
          profilePictureUrl: data.profilePictureUrl,
          isVerified: data.isVerified || false,
          score: score,
          matchType: matchType
        };
        resultsMap.set(docSnap.id, user);
        console.log(`Added user: ${user.name} (@${user.username}) - Match: ${matchType}, Score: ${score}`);
      }
      
      // Get current user data
      let currentUserData = null;
      try {
        const currentUserDoc = await usersRef.doc(currentUserId).get();
        if (currentUserDoc.exists) {
          currentUserData = currentUserDoc.data();
          console.log(`Current user: ${currentUserData.name} (@${currentUserData.username})`);
        }
      } catch (e) {
        console.error('Error fetching current user data:', e);
      }
      
      // Check if it's email search
      if (isEmailAdmin(trimmedSearchTerm)) {
        console.log('Performing email search...');
        try {
          const emailQuery = await usersRef.where('email', '==', trimmedSearchTerm).limit(SEARCH_LIMIT).get();
          emailQuery.forEach((docSnap) => {
            if (docSnap.id !== currentUserId) {
              addUserToResults(docSnap, 'email_exact', 100);
            }
          });
        } catch (e) {
          console.error('Error during email search:', e);
        }
      }
      
      // Check if it's phone search
      if (resultsMap.size < SEARCH_LIMIT && isPhoneNumberAdmin(trimmedSearchTerm)) {
        console.log('Performing phone search...');
        try {
          const phoneQuery = await usersRef.where('phoneNumber', '==', trimmedSearchTerm).limit(SEARCH_LIMIT).get();
          phoneQuery.forEach((docSnap) => {
            if (docSnap.id !== currentUserId && !resultsMap.has(docSnap.id)) {
              addUserToResults(docSnap, 'phone_exact', 95);
            }
          });
        } catch (e) {
          console.error('Error during phone search:', e);
        }
      }
      
      // Comprehensive text search
      if (resultsMap.size < SEARCH_LIMIT && !isEmailAdmin(trimmedSearchTerm) && !isPhoneNumberAdmin(trimmedSearchTerm)) {
        console.log('Performing comprehensive text search...');
        try {
          const allUsersSnapshot = await usersRef.limit(500).get();
          console.log(`Checking ${allUsersSnapshot.size} users for text matches...`);
          
          allUsersSnapshot.forEach((docSnap) => {
            if (docSnap.id === currentUserId || resultsMap.has(docSnap.id)) return;
            
            const data = docSnap.data();
            const name = data.name || '';
            const username = data.username || '';
            
            console.log(`Checking user: ${name} (@${username})`);
            
            // Check for exact matches first
            if (exactMatch(name, trimmedSearchTerm)) {
              addUserToResults(docSnap, 'name_exact', 90);
            } else if (exactMatch(username, trimmedSearchTerm)) {
              addUserToResults(docSnap, 'username_exact', 85);
            }
            // Check for prefix matches
            else if (startsWithText(name, trimmedSearchTerm)) {
              addUserToResults(docSnap, 'name_prefix', 80);
            } else if (startsWithText(username, trimmedSearchTerm)) {
              addUserToResults(docSnap, 'username_prefix', 75);
            }
            // Check for substring matches
            else if (containsText(name, trimmedSearchTerm)) {
              addUserToResults(docSnap, 'name_substring', 60);
            } else if (containsText(username, trimmedSearchTerm)) {
              addUserToResults(docSnap, 'username_substring', 55);
            }
          });
        } catch (e) {
          console.error('Error during comprehensive search:', e);
        }
      }
      
      console.log('\nSearch Results:');
      console.log('=' .repeat(40));
      console.log(`Found ${resultsMap.size} users matching "${searchTerm}"`);
      
      const resultsArray = Array.from(resultsMap.values());
      resultsArray.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (@${user.username}) - ${user.matchType} (Score: ${user.score})`);
      });
      
    } catch (error) {
      console.error('Error during search test:', error);
    }
  }

  testSearch().then(() => {
    console.log('\nSearch test completed');
    process.exit(0);
  });

} catch (error) {
  console.error('Error initializing Firebase:', error);
  process.exit(1);
}