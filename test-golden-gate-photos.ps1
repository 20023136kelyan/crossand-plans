# Test Google Places API for Golden Gate Bridge photos
$apiKey = "AIzaSyAF30T-RULxg0nWZqNT2Nth0UHnVJSJ_Ro"
$placeId = "ChIJw____96GhYARCVVwg5cT7c0"
$url = "https://maps.googleapis.com/maps/api/place/details/json?place_id=$placeId&fields=photos&key=$apiKey"

Write-Host "Testing Google Places API for Golden Gate Bridge photos..."
Write-Host "URL: $url"
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $url -Method GET
    $jsonResponse = $response.Content | ConvertFrom-Json
    
    Write-Host "API Response Status: $($jsonResponse.status)"
    
    if ($jsonResponse.result.photos) {
        Write-Host "Photos found: $($jsonResponse.result.photos.Count)"
        Write-Host "Photo details:"
        foreach ($photo in $jsonResponse.result.photos) {
            Write-Host "  - Photo Reference: $($photo.photo_reference)"
            Write-Host "    Width: $($photo.width), Height: $($photo.height)"
        }
    } else {
        Write-Host "No photos found in the response"
    }
    
    Write-Host ""
    Write-Host "Full JSON Response:"
    Write-Host ($jsonResponse | ConvertTo-Json -Depth 10)
    
} catch {
    Write-Host "Error occurred: $($_.Exception.Message)"
    Write-Host "Full error: $_"
}