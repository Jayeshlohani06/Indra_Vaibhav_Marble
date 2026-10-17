$env:DB_PASSWORD="yourpassword"

code C:\Users\jayes\Desktop\indra-vaibhav-marble\backend\src\main\resources\db\migration

mvn clean compile

mvn clean spring-boot:run

psql -U postgres -d postgres

Step 1: Enter your email
In your PowerShell terminal, run:
$email = "jayeshlohani06@gmail.com"


Then verify it:
$email


Expected output:
jayeshlohani06@gmail.com


Step 2: Enter your password securely
Run this separately:
$securePassword = Read-Host "Enter your ERP password" -AsSecureString


Type your password and press Enter. The password will not appear on the screen.
Now check that the variable exists without displaying your password:
$securePassword -ne $null


Expected output:
True


Remove-Variable token -ErrorAction SilentlyContinue
Remove-Variable headers -ErrorAction SilentlyContinue

$token = Read-Host "Paste your JWT token here"

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

if ($headers.ContainsKey("Authorization")) {
    Write-Host "Authorization header configured successfully"
}