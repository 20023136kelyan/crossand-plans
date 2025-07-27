/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      // Social Media
      'i.ytimg.com', // YouTube
      'scontent.cdninstagram.com', // Instagram
      'pbs.twimg.com', // Twitter
      'platform-lookaside.fbsbx.com', // Facebook
      'scontent-*.fna.fbcdn.net', // Facebook CDN
      'scontent-*.xx.fbcdn.net', // Facebook CDN
      'scontent-*.xy.fbcdn.net', // Facebook CDN
      'scontent-*.fbcdn.net', // Facebook CDN
      'i.scdn.co', // Spotify
      'i1.sndcdn.com', // SoundCloud
      'i.vimeocdn.com', // Vimeo
      'static-cdn.jtvnw.net', // Twitch
      'i.redd.it', // Reddit
      'i.pinimg.com', // Pinterest
      'avatars.githubusercontent.com', // GitHub
      'codepen.io', // CodePen
      's3-alpha.figma.com', // Figma
      'microlink.io', // Microlink
      'img.youtube.com', // YouTube thumbnails
      'yt3.ggpht.com', // YouTube thumbnails
      'yt3.googleusercontent.com' // YouTube thumbnails
    ],
    // Allow all domains for now, but you can restrict to specific patterns
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
