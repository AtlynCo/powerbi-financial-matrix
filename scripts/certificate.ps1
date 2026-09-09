param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
try {
    $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
        'CN=localhost', $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256,
        [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
    )
    $certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddDays(7))
    try {
        $password = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
        [System.IO.File]::WriteAllBytes(
            (Join-Path $Directory 'PowerBICustomVisualTest_public.pfx'),
            $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)
        )
        [System.IO.File]::WriteAllText((Join-Path $Directory 'PowerBICustomVisualTestPass.txt'), $password)
    } finally {
        $certificate.Dispose()
    }
} finally {
    $rsa.Dispose()
}
