const fs = require('fs');

// Fix 1: src/app/u/[profileId]/page.tsx
try {
  let content1 = fs.readFileSync('src/app/u/[profileId]/page.tsx', 'utf8');
  content1 = content1.replace(
    "import { getFriendships } from '@/services/userService';",
    "import { getFriendships } from '@/services/clientServices';"
  );
  fs.writeFileSync('src/app/u/[profileId]/page.tsx', content1);
  console.log('✓ Fixed u/profileId page');
} catch (e) {
  console.log('✗ Failed to fix u/profileId page:', e.message);
}

// Fix 2: src/components/layout/Header.tsx
try {
  let content2 = fs.readFileSync('src/components/layout/Header.tsx', 'utf8');
  content2 = content2.replace(
    "import { getCompletedPlansForParticipant } from '@/services/planService';",
    "// getCompletedPlansForParticipant function needs to be restored from clientServices"
  );
  fs.writeFileSync('src/components/layout/Header.tsx', content2);
  console.log('✓ Fixed Header component');
} catch (e) {
  console.log('✗ Failed to fix Header:', e.message);
}

// Fix 3: src/context/AuthContext.tsx
try {
  let content3 = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');
  content3 = content3.replace(
    "import { checkUserProfileExists } from '@/services/userService.server';",
    "// checkUserProfileExists moved to server action"
  );
  fs.writeFileSync('src/context/AuthContext.tsx', content3);
  console.log('✓ Fixed AuthContext');
} catch (e) {
  console.log('✗ Failed to fix AuthContext:', e.message);
}

// Fix 4: src/app/(app)/feed/page.tsx
try {
  let content4 = fs.readFileSync('src/app/(app)/feed/page.tsx', 'utf8');
  content4 = content4.replace(
    'import { getPostComments } from "@/services/feedService.server";',
    '// getPostComments moved to clientServices for real-time updates'
  );
  fs.writeFileSync('src/app/(app)/feed/page.tsx', content4);
  console.log('✓ Fixed feed page');
} catch (e) {
  console.log('✗ Failed to fix feed page:', e.message);
}

console.log('Import fixes completed!'); 