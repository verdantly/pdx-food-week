# scrape_tacos.ps1
# Scraping, parsing, reverse-geocoding, caching, and generating data/tacoweek2026.js

$scriptDir = $PSScriptRoot
$projectRoot = Resolve-Path "$scriptDir\.."
$cachePath = Join-Path $projectRoot "data\geocode_cache.json"
$outputPath = Join-Path $projectRoot "data\tacoweek2026.js"

# Ensure output data directory exists
$dataDir = Split-Path -Path $outputPath
if (!(Test-Path -Path $dataDir)) {
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
}

# Helper: Convert PSCustomObject to Hashtable for PS 5.1 compatibility
function Convert-ObjectToHashtable($obj) {
    $hash = @{}
    if ($null -eq $obj) { return $hash }
    foreach ($prop in $obj.PSObject.Properties) {
        $hash[$prop.Name] = $prop.Value
    }
    return $hash
}

# 1. Load geocode cache
$geoCache = @{}
if (Test-Path -Path $cachePath) {
    try {
        $cacheRaw = Get-Content -Raw -Path $cachePath -Encoding utf8
        $parsedJson = ConvertFrom-Json $cacheRaw
        $geoCache = Convert-ObjectToHashtable $parsedJson
        Write-Output "Loaded $($geoCache.Count) cached coordinates."
    } catch {
        Write-Warning "Failed to load cache, starting fresh: $_"
    }
}

# Helper: Save geocode cache
function Save-GeocodeCache {
    [System.IO.File]::WriteAllText($cachePath, ($geoCache | ConvertTo-Json -Depth 5), [System.Text.Encoding]::UTF8)
}

# Helper: Title Case Converter
function Convert-ToTitleCase($str) {
    if ([string]::IsNullOrWhiteSpace($str)) { return "" }
    if ($str -eq $str.ToUpper() -and $str -ne $str.ToLower()) {
        $textInfo = (Get-Culture).TextInfo
        # Force lower first
        return $textInfo.ToTitleCase($str.ToLower())
    }
    return $str
}

# Helper: Sentence Case Converter
function Convert-ToSentenceCase($str) {
    if ([string]::IsNullOrWhiteSpace($str)) { return "" }
    if ($str -eq $str.ToUpper() -and $str -ne $str.ToLower()) {
        $str = $str.ToLower()
        $sentences = $str -split '(?<=\.\s+)'
        $result = foreach ($s in $sentences) {
            if ($s.Length -gt 0) {
                $s.Substring(0,1).ToUpper() + $s.Substring(1)
            } else {
                $s
            }
        }
        return ($result -join '')
    }
    return $str
}

# Helper: Alphanumeric cleaner for fuzzy name matching
function Clean-Name($str) {
    if (!$str) { return "" }
    return ($str.ToLower() -replace '[^a-z0-9]', '')
}

# 2. Load context JSON for Squarespace image assets
Write-Output "Loading Squarespace context JSON..."
$jsonContent = Get-Content -Raw -Path $jsonPath -Encoding utf8 | ConvertFrom-Json
$squarespaceItems = $jsonContent.userItems
$squarespaceMap = @{}
foreach ($item in $squarespaceItems) {
    $key = Clean-Name $item.title
    if ($key) {
        $squarespaceMap[$key] = $item
    }
}

# 3. Load and parse KML
Write-Output "Parsing KML map..."
[xml]$kml = Get-Content -Path $kmlPath -Encoding utf8
$placemarks = $kml.SelectNodes("//*[local-name()='Placemark']")
Write-Output "Found $($placemarks.Count) placemarks in KML."

$entries = @()
$counter = 1

foreach ($pm in $placemarks) {
    $name = $pm.SelectNodes("./*[local-name()='name']").InnerText.Trim()
    
    # Skip placeholders or empty names
    if ($name -match "Coming Soon" -or $name -eq "") {
        continue
    }
    
    $descHtml = $pm.SelectNodes("./*[local-name()='description']").InnerText
    $coordsText = $pm.SelectNodes(".//*[local-name()='coordinates']").InnerText.Trim()
    
    # Parse coordinates: lng,lat,0
    $parts = $coordsText -split ','
    $lng = [double]$parts[0]
    $lat = [double]$parts[1]
    
    # Image resolution: KML vs JSON
    $image = ""
    $sqTitle = ""
    $key = Clean-Name $name
    if ($squarespaceMap.ContainsKey($key)) {
        $ssItem = $squarespaceMap[$key]
        $image = $ssItem.image.assetUrl
        $sqTitle = $ssItem.title
    }
    
    # If no match in JSON, fallback to KML description image
    if ([string]::IsNullOrEmpty($image) -and $descHtml -match 'src="([^"]+)"') {
        $image = $Matches[1]
    }
    
    # Extract raw text from description CDATA
    $textOnly = $descHtml -replace '<img[^>]*>', ''
    $textOnly = $textOnly -replace '<br\s*/?>', ' '
    $textOnly = $textOnly -replace '\s+', ' '
    $textOnly = $textOnly.Trim()
    
    # Split description into dish and description details
    $dish = "Special Taco"
    $desc = $textOnly
    if ($textOnly -match '^([^:]+):\s*(.*)$') {
        $dish = $Matches[1].Trim()
        $desc = $Matches[2].Trim()
    } else {
        # Fallback search for "called the X"
        if ($textOnly -match 'IT IS CALLED THE (.*?)\.?$') {
            $dish = $Matches[1].Trim()
        }
    }
    
    # Casing normalization
    $dish = Convert-ToTitleCase $dish
    $desc = Convert-ToSentenceCase $desc
    
    # Reverse geocoding with caching
    $cacheKey = "$lat,$lng"
    $address = ""
    $streetAddress = ""
    $neighborhood = ""
    
    if ($geoCache.ContainsKey($cacheKey)) {
        $cached = $geoCache[$cacheKey]
        $address = $cached.address
        $streetAddress = $cached.streetAddress
        $neighborhood = $cached.neighborhood
    } else {
        Write-Output "Reverse geocoding $name ($cacheKey)..."
        $geoUrl = "https://nominatim.openstreetmap.org/reverse?lat=$lat&lon=$lng&format=json"
        
        try {
            $res = Invoke-RestMethod -Uri $geoUrl -UserAgent "pdx-food-week-app/1.0 (https://github.com/oberonix/pdx-food-week)"
            Start-Sleep -Milliseconds 1200 # Nominatim rate-limit friendly
            
            $addr = $res.address
            $houseNum = $addr.house_number
            $road = $addr.road
            
            if ($addr.suburb) { $neighborhood = $addr.suburb }
            elseif ($addr.neighbourhood) { $neighborhood = $addr.neighbourhood }
            elseif ($addr.quarter) { $neighborhood = $addr.quarter }
            elseif ($addr.city_district) { $neighborhood = $addr.city_district }
            elseif ($addr.village) { $neighborhood = $addr.village }
            elseif ($addr.town) { $neighborhood = $addr.town }
            
            $city = $addr.city
            if (!$city) { $city = $addr.town }
            if (!$city) { $city = $addr.village }
            if (!$city) { $city = "Portland" }
            
            $postcode = $addr.postcode
            
            # Format addresses nicely
            if ($houseNum -and $road) {
                $streetAddress = "$houseNum $road"
            } elseif ($road) {
                $streetAddress = $road
            } else {
                $streetAddress = $res.display_name.Split(',')[0].Trim()
            }
            
            # Replace full street terms with short forms like in scrape.js
            $streetAddress = $streetAddress `
                -replace '\bStreet\b', 'St' `
                -replace '\bAvenue\b', 'Ave' `
                -replace '\bBoulevard\b', 'Blvd' `
                -replace '\bRoad\b', 'Rd'
                
            $address = "$streetAddress, $city, OR"
            if ($postcode) { $address = "$address $postcode" }
            
            # Cache the result
            $geoCache[$cacheKey] = @{
                address = $address
                streetAddress = $streetAddress
                neighborhood = $neighborhood
            }
            Save-GeocodeCache
        } catch {
            Write-Warning "Geocoding failed for ${name}: $_"
            # Fallback to defaults
            $address = "Portland, OR"
            $streetAddress = ""
            $neighborhood = ""
        }
    }
    
    # Dietary type & glutenFree tag detection
    $bothText = ($dish + " " + $desc + " " + $sqTitle).ToLower()
    
    $isMushroomBirria = ($bothText -match "mushroom|hongos|lion’s mane|lion's mane") -and ($bothText -notmatch "beef|pork|chicken")
    $isSoyCurlAsada = $bothText -match "soy curl"
    
    $hasRealMeat = ($bothText -match "chicken|pollo|tinga|beef|steak|asada|birria|carnitas|pork|bacon|chorizo|longaniza|ribeye|rib eye|brisket|chicharron|shrimp|seafood|fish|salmon|crab|cod|ostrich|kebab|char siu") -and !$isSoyCurlAsada -and !$isMushroomBirria
    
    $type = "meat"
    if (!$hasRealMeat) {
        if ($bothText -match "\bvegan\b" -or $isSoyCurlAsada) {
            $type = "vegan"
        } elseif ($bothText -match "\bvegetarian\b|\bveggie\b|\bvegetariano\b|\btofu\b" -or $isMushroomBirria -or $bothText -match "avocado" -or $bothText -match "s.more|s'more|tres leches" -or $name -match "Bring! Treats for Dogs") {
            $type = "vegetarian"
        }
    }
    
    $glutenFree = $false
    if ($bothText -match "\bgluten[- ]free\b|\bgf\b") { $glutenFree = $true }
    
    $spicy = $false
    if ($bothText -match "\bspicy\b|\bchile\b|\bjalapeno\b|\bserrano\b|\bhabanero\b|\bhot\b") { $spicy = $true }
    
    # Emoji heuristic based on ingredients using encoding-safe escape sequences
    $emoji = [char]::ConvertFromUtf32(0x1F32E) # default Taco 🌮
    if ($bothText -match "shrimp|seafood|fish|salmon|crab|cod") { $emoji = [char]::ConvertFromUtf32(0x1F41F) } # Fish 🐟
    elseif ($bothText -match "chicken|pollo") { $emoji = [char]::ConvertFromUtf32(0x1F357) } # Poultry leg 🍗
    elseif ($bothText -match "pork|carnitas|chorizo|al pastor|ham|bacon|char siu") { $emoji = [char]::ConvertFromUtf32(0x1F416) } # Pig 🐖
    elseif (($bothText -match "beef|steak|asada|birria|carne|brisket") -and !$isSoyCurlAsada -and !$isMushroomBirria) { $emoji = [char]::ConvertFromUtf32(0x1F969) } # Meat 🥩
    elseif ($bothText -match "ostrich") { $emoji = [char]::ConvertFromUtf32(0x1FAB0) } # Dodo 🦤
    elseif ($bothText -match "mushroom|hongos") { $emoji = [char]::ConvertFromUtf32(0x1F344) } # Mushroom 🍄
    elseif ($bothText -match "avocado") { $emoji = [char]::ConvertFromUtf32(0x1F951) } # Avocado 🥑
    elseif ($type -eq "vegan") { $emoji = [char]::ConvertFromUtf32(0x1F331) } # Seedling 🌱
    elseif ($type -eq "vegetarian") { $emoji = [char]::ConvertFromUtf32(0x1F33F) } # Herb 🌿
    elseif ($bothText -match "spicy|hot|chile") { $emoji = [char]::ConvertFromUtf32(0x1F336) + [char]0xFE0F } # Pepper 🌶️
    
    $entries += @{
        id = $counter
        weekId = "taco-2026"
        dish = $dish
        restaurant = $name
        neighborhood = $neighborhood
        address = $address
        lat = $lat
        lng = $lng
        type = $type
        glutenFree = $glutenFree
        spicy = $spicy
        minors = $true
        takeout = $true
        desc = $desc
        emoji = $emoji
        image = $image
        url = "https://www.theactualportland.com/locations"
    }
    $counter++
}

# 4. Generate JavaScript Output File
Write-Output "Sorting entries..."
# Sort entries by ID to keep it stable
$sortedEntries = $entries | Sort-Object id

# Format JSON block manually to match EverOut's structure
$entriesJsonList = @()
foreach ($e in $sortedEntries) {
    $gfVal = if ($e.glutenFree) { "true" } else { "false" }
    $spVal = if ($e.spicy) { "true" } else { "false" }
    $minVal = if ($e.minors) { "true" } else { "false" }
    $toVal = if ($e.takeout) { "true" } else { "false" }
    
    $itemStr = @"
  {
    "id": $($e.id),
    "weekId": "$($e.weekId)",
    "dish": "$($e.dish -replace '"', '\"')",
    "restaurant": "$($e.restaurant -replace '"', '\"')",
    "neighborhood": "$($e.neighborhood -replace '"', '\"')",
    "address": "$($e.address -replace '"', '\"')",
    "lat": $($e.lat),
    "lng": $($e.lng),
    "type": "$($e.type)",
    "glutenFree": $gfVal,
    "spicy": $spVal,
    "minors": $minVal,
    "takeout": $toVal,
    "desc": "$($e.desc -replace '"', '\"')",
    "emoji": "$($e.emoji)",
    "image": "$($e.image)",
    "url": "$($e.url)"
  }
"@
    $entriesJsonList += $itemStr
}

$entriesBlock = "[" + ($entriesJsonList -join ",`n") + "]"

$jsContent = @"
// The Actual Portland's Taco Week 2026 — scraped $(Get-Date -Format "yyyy-MM-dd")
// $($sortedEntries.Count) locations
// Source: https://www.theactualportland.com/locations

window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push({
  id: "taco-2026",
  name: "Taco Week 2026",
  organizer: "The Actual Portland",
  dates: "June 1–7, 2026",
  pricePills: ["`$5 taco", "2 for `$5"],
  color: "#D48C2C",
  colorDark: "#945B13",
  colorLight: "#FCEFD8",
  colorPale: "#FEF9F0",
  emoji: "🌮",
  totalLocations: $($sortedEntries.Count),
  url: "https://www.theactualportland.com/locations"
});

window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = $entriesBlock;
  newItems.forEach(item => {
    if (!window.RESTAURANTS.some(r => r.id === item.id && r.weekId === item.weekId)) {
      window.RESTAURANTS.push(item);
    }
  });
})();
"@

[System.IO.File]::WriteAllText($outputPath, $jsContent, [System.Text.Encoding]::UTF8)
Write-Output "✅ Generated $outputPath with $($sortedEntries.Count) locations."
