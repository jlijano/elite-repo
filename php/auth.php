<?php
declare(strict_types=1);

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed. Use POST.'
    ]);
    exit;
}

$email = trim((string)($_POST['email'] ?? ''));
$password = (string)($_POST['password'] ?? '');

if ($email === '' || $password === '') {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => 'Email and password are required.'
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| Temporary login endpoint
|--------------------------------------------------------------------------
| Replace this demo block with database-backed authentication.
| Recommended production flow:
| 1. Query user by email.
| 2. Verify password with password_verify().
| 3. Start a secure session.
| 4. Return user/workspace data.
*/

echo json_encode([
    'success' => true,
    'message' => 'Login endpoint connected.',
    'user' => [
        'email' => $email,
        'workspace' => 'Playground'
    ]
]);
