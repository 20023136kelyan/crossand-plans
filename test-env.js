console.log('=== Environment Variable Test ===');
console.log('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
console.log('API Key length:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.length);
console.log('API Key starts with:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.substring(0, 10));
console.log('All NEXT_PUBLIC env vars:');
Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_')).forEach(key => {
  console.log(`${key}: ${process.env[key]?.substring(0, 10)}...`);
}); 