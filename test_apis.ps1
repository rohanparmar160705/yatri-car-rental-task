# Professional API Testing Script for Real-Time Secure Communication API
$baseUrl = "http://localhost:5000/api"
$email = "rohanrock360@gmail.com"
$password = "TestPass123!"
$filePath = "C:\Users\Rohan\Downloads\mermaid.png"

# Helper to show full responses
function Show-Response($label, $response) {
    Write-Host "`n>>> $label" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
}

# Helper to show full error responses
function Show-Error($label, $error) {
    Write-Host "`n!!! ERROR: $label" -ForegroundColor Red
    if ($error.Exception.Response) {
        $stream = $error.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respText = $reader.ReadToEnd()
        Write-Host "Response Body: $respText" -ForegroundColor DarkRed
    } else {
        Write-Host "Exception: $($error.Exception.Message)" -ForegroundColor DarkRed
    }
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "  YATRI API TEST SUITE: COMPLETE FLOW  " -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

# 1. Sign-up
Write-Host "Step 1: Signing up user..." -ForegroundColor Yellow
try {
    $signupBody = @{ email = $email; password = $password } | ConvertTo-Json
    $signupResponse = Invoke-RestMethod -Uri "$baseUrl/auth/signup" -Method Post -Body $signupBody -ContentType "application/json"
    Show-Response "SIGNUP RESPONSE" $signupResponse
} catch {
    Show-Error "SIGNUP FAILED" $_
    if ($_.Exception.Response.StatusCode -eq "BadRequest") {
        Write-Host " [INFO] User already exists. Continuing..." -ForegroundColor Yellow
    }
}

# 2. OTP Verification (INTERACTIVE)
Write-Host "`n[CHECK YOUR EMAIL] Please enter the OTP sent to $email" -ForegroundColor Yellow
Write-Host "***********************************" -ForegroundColor Yellow
$otp = Read-Host "ENTER OTP HERE "
Write-Host "***********************************`n" -ForegroundColor Yellow

if ($otp) {
    Write-Host "Step 2: Verifying OTP..." -ForegroundColor Yellow
    try {
        $verifyBody = @{ email = $email; otp = $otp } | ConvertTo-Json
        $verifyResponse = Invoke-RestMethod -Uri "$baseUrl/auth/verify" -Method Post -Body $verifyBody -ContentType "application/json"
        Show-Response "VERIFY RESPONSE" $verifyResponse
    } catch {
        Show-Error "VERIFY FAILED" $_
    }
}

# 3. Sign-in
Write-Host "Step 3: Signing in & Saving Cookies..." -ForegroundColor Yellow
try {
    $signinBody = @{ email = $email; password = $password } | ConvertTo-Json -Compress
    # Using curl to save cookies to a file
    $signinResponseRaw = curl.exe -s -c cookies.txt -X POST "$baseUrl/auth/signin" -H "Content-Type: application/json" -d $signinBody.Replace('"', '\"')
    $signinResponse = $signinResponseRaw | ConvertFrom-Json
    Show-Response "SIGNIN RESPONSE" $signinResponse
    
    $token = $signinResponse.accessToken
    $userId = $signinResponse.user.id
    $headers = @{ Authorization = "Bearer $token" }
} catch {
    Show-Error "SIGNIN FAILED" $_
    Write-Host "Stopping script as Auth failed." -ForegroundColor Red
    return
}

# 4. Refresh Token Test
Write-Host "`nStep 4: Testing Token Refresh (Reading cookies.txt)..." -ForegroundColor Yellow
try {
    Write-Host "Sending refresh request..." -ForegroundColor DarkGray
    # Using curl to send cookies from the file
    $refreshResponseRaw = curl.exe -s -b cookies.txt -X POST "$baseUrl/auth/refresh"
    $refreshResponse = $refreshResponseRaw | ConvertFrom-Json
    Show-Response "REFRESH RESPONSE" $refreshResponse
} catch {
    Show-Error "REFRESH FAILED (Missing Cookie?)" $_
}

# 5. Search User
Write-Host "`nStep 5: Searching for user by email..." -ForegroundColor Yellow
try {
    $searchResponse = Invoke-RestMethod -Uri "$baseUrl/auth/search?email=$email" -Method Get -Headers $headers
    Show-Response "SEARCH RESPONSE" $searchResponse
} catch {
    Show-Error "SEARCH FAILED" $_
}

# 6. File Upload
Write-Host "`nStep 6: Testing File Upload..." -ForegroundColor Yellow
try {
    if (Test-Path $filePath) {
        Write-Host "Uploading file: $filePath" -ForegroundColor DarkGray
        # Using curl.exe for robust multipart support
        $fileUploadResponse = curl.exe -X POST "$baseUrl/files/upload" `
            -H "Authorization: Bearer $token" `
            -F "file=@$filePath"
        
        $fileData = $fileUploadResponse | ConvertFrom-Json
        Show-Response "FILE UPLOAD RESPONSE" $fileData
        $fileId = $fileData.data.id
    } else {
        Write-Host " [SKIP] File not found at $filePath" -ForegroundColor Yellow
        $fileId = $null
    }
} catch {
    Show-Error "FILE UPLOAD FAILED" $_
    $fileId = $null
}

# 7. Messaging CRUD
Write-Host "`nStep 7: Testing Messaging CRUD..." -ForegroundColor Yellow
try {
    # Send
    $msgContent = "Automated Test Message with file at $(Get-Date)"
    $msgBody = @{ receiver_id = $userId; content = $msgContent; file_id = $fileId } | ConvertTo-Json
    $msgResponse = Invoke-RestMethod -Uri "$baseUrl/messages" -Method Post -Body $msgBody -Headers $headers -ContentType "application/json"
    Show-Response "SEND MESSAGE RESPONSE" $msgResponse
    
    $msgId = $msgResponse.data.id

    # Get History
    $historyResponse = Invoke-RestMethod -Uri "$baseUrl/messages/$userId" -Method Get -Headers $headers
    Show-Response "GET HISTORY RESPONSE (Count: $($historyResponse.data.Count))" $historyResponse

    # Edit
    $editBody = @{ content = "Message edited by test script at $(Get-Date)" } | ConvertTo-Json
    $editResponse = Invoke-RestMethod -Uri "$baseUrl/messages/$msgId" -Method Put -Body $editBody -Headers $headers -ContentType "application/json"
    Show-Response "EDIT MESSAGE RESPONSE" $editResponse

    # Delete (Delete Message)
    $delResponse = Invoke-RestMethod -Uri "$baseUrl/messages/$msgId" -Method Delete -Headers $headers
    Show-Response "DELETE MESSAGE RESPONSE" $delResponse

} catch {
    Show-Error "MESSAGING CRUD FAILED" $_
}

# 8. Connections API
Write-Host "`nStep 8: Testing Connections API..." -ForegroundColor Yellow
try {
    # 8.1 Create Connection (to self for testing, though usually blocked, let's just test the endpoint)
    Write-Host "Creating connection..." -ForegroundColor DarkGray
    try {
        $connCreateBody = @{ connected_user_id = $userId } | ConvertTo-Json
        $connCreateResponse = Invoke-RestMethod -Uri "$baseUrl/connections" -Method Post -Body $connCreateBody -Headers $headers -ContentType "application/json"
        Show-Response "CREATE CONNECTION RESPONSE" $connCreateResponse
    } catch {
        Write-Host " [INFO] Connection already exists or self-connection blocked." -ForegroundColor Yellow
    }

    # 8.2 Get Connections
    $connResponse = Invoke-RestMethod -Uri "$baseUrl/connections" -Method Get -Headers $headers
    Show-Response "GET CONNECTIONS RESPONSE" $connResponse
    
    if ($connResponse.length -gt 0) {
        $connectionId = $connResponse[0].connected_user_id # Using user_id for delete logic
        # 8.3 Delete Connection
        Write-Host "Deleting first connection..." -ForegroundColor DarkGray
        $connDelResponse = Invoke-RestMethod -Uri "$baseUrl/connections/$connectionId" -Method Delete -Headers $headers
        Show-Response "DELETE CONNECTION RESPONSE" $connDelResponse
    }
} catch {
    Show-Error "CONNECTIONS API FAILED" $_
}

# 9. Logout
Write-Host "`nStep 9: Testing Logout (Reading cookies.txt)..." -ForegroundColor Yellow
try {
    # Using curl to ensure HttpOnly cookie is sent
    $logoutResponseRaw = curl.exe -s -b cookies.txt -X POST "$baseUrl/auth/logout" -H "Authorization: Bearer $token"
    $logoutResponse = $logoutResponseRaw | ConvertFrom-Json
    Show-Response "LOGOUT RESPONSE" $logoutResponse
} catch {
    Show-Error "LOGOUT FAILED" $_
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "       YATRI API TEST SUITE COMPLETE!       " -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan
