# Multi-User Setup Instructions

## Understanding the Admin User Logic

In the current implementation, the first user to register automatically becomes the admin user. This replaces the previous environment variable-based approach.

## Troubleshooting Steps

If you're having issues with admin privileges or registration:

### 1. Check Database State
First, verify if there are already users in the database:
```bash
# Navigate to your project directory
cd /workspace/Claude_Assist/cloudcli

# Check if there are existing users in the database
sqlite3 server/data/auth.db "SELECT * FROM users;"
```

### 2. Clear Database (if needed)
If you want to start fresh with a clean database:
```bash
# Remove the existing database file
rm server/data/auth.db

# Restart the server
npm run server
```

### 3. Register as First User
1. Open the application in a new browser window (incognito mode recommended)
2. You should see the registration screen
3. Register with your desired username/password
4. This user should automatically become the admin

### 4. Verify Admin Status
After registration, the first user should have:
- `approval_status = 'approved'`
- `isAdmin: true` in their authentication response

### 5. Subsequent Users
Additional users will:
- Have `approval_status = 'pending'`
- Need to be approved by the admin user

## Important Notes

- The environment variable `CLOUDCLI_ADMIN_USERNAME` is no longer used in the current implementation
- The system relies on the first user registered being the admin
- If you're seeing issues, try clearing the database and starting fresh
- Make sure you're accessing the application in a clean state (no existing session cookies)

## Expected Behavior

1. **Fresh Installation**: First user registers → becomes admin automatically
2. **Existing Installation**: If database already has users, the system will still work as expected
3. **Admin Approval**: Admin users can approve/deny pending users through the admin interface