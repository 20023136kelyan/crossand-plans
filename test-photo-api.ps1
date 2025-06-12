# Test Google Places Photo API
$apiKey = "AIzaSyAF30T-RULxg0nWZqNT2Nth0UHnVJSJ_Ro"

# First, get a place with photos
try {
    Write-Host "Testing Places Text Search API..."
    $searchUrl = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+paris&key=$apiKey"
    $searchResponse = Invoke-RestMethod -Uri $searchUrl
    
    if ($searchResponse.results -and $searchResponse.results.Count -gt 0) {
        $place = $searchResponse.results[0]
        Write-Host "Found place: $($place.name)"
        Write-Host "Place ID: $($place.place_id)"
        
        if ($place.photos -and $place.photos.Count -gt 0) {
            $photoRef = $place.photos[0].photo_reference
            Write-Host "Photo reference: $photoRef"
            
            # Test photo API
            Write-Host "Testing Photo API..."
            $photoUrl = "https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=$photoRef&key=$apiKey"
            
            try {
                $photoResponse = Invoke-WebRequest -Uri $photoUrl
                Write-Host "Photo API Status: $($photoResponse.StatusCode)"
                Write-Host "Content-Type: $($photoResponse.Headers['Content-Type'])"
                Write-Host "Content-Length: $($photoResponse.Headers['Content-Length'])"
            } catch {
                Write-Host "Photo API Error: $($_.Exception.Message)"
                if ($_.Exception.Response) {
                    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
                }
            }
        } else {
            Write-Host "No photos available for this place"
        }
    } else {
        Write-Host "No places found"
    }
} catch {
    Write-Host "Search API Error: $($_.Exception.Message)"
}