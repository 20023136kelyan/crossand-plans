# Image Directory Structure

This directory contains all the static images used throughout the Macaroom application.

## Directory Structure

```
public/images/
├── admin/
│   ├── dashboard/    # Admin dashboard specific images
│   └── reports/      # Report templates and graphics
├── backgrounds/      # General background images
├── categories/       # Category cover images and icons
├── celebrity/        # Celebrity profile and plan images
├── cities/          # City cover images and landmarks
├── creators/        # Creator profile images
├── logos/           # Application logos and branding
├── plans/           # Plan-related images
└── users/           # User profile images and uploads
```

## Usage Guidelines

### Image Requirements

- **Format**: Prefer WebP format for web images, with JPEG/PNG fallbacks
- **Size Limits**:
  - Cover Images: Max 1920x1080px, optimized for web
  - Profile Pictures: 500x500px recommended
  - Thumbnails: 150x150px
- **File Size**: 
  - Cover Images: Max 500KB
  - Profile Pictures: Max 200KB
  - Thumbnails: Max 50KB

### Directory-Specific Guidelines

#### Admin (/admin)
- Dashboard images should be optimized for quick loading
- Report templates should be in vector format when possible

#### Categories (/categories)
- Category images should be consistent in style
- Use descriptive filenames (e.g., "outdoor-activities-cover.webp")

#### Cities (/cities)
- City covers should be recognizable landmarks
- Include both day and night variations if possible

#### Celebrity & Creators (/celebrity, /creators)
- High-quality professional images
- Include both profile and cover image options

#### Plans (/plans)
- Organized by plan ID or category
- Include thumbnails for quick loading

#### Users (/users)
- Implement proper privacy controls
- Auto-generate different sizes for responsiveness

### Naming Conventions

1. Use lowercase letters and hyphens
2. Include dimensions in filename when relevant
3. Follow pattern: `[category]-[name]-[dimension].[extension]`

Example:
```
category-outdoor-1920x1080.webp
city-paris-cover-1280x720.webp
profile-default-500x500.webp
```

### Admin Functionality

For admin dashboard:
1. Use /admin/dashboard for UI elements
2. Store report templates in /admin/reports
3. Keep separate directories for different report types

### Image Processing

- Implement WebP conversion
- Auto-generate required sizes
- Compress on upload
- Maintain aspect ratios
- Store metadata in database

### Security Guidelines

1. Validate file types
2. Scan for malware
3. Implement proper permissions
4. Use signed URLs for sensitive content
5. Regular cleanup of unused images 