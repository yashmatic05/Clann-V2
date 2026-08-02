# Clann Auth Testing Playbook

## Auth-Gated App Testing

### Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  role: 'attendee',
  city: 'Delhi',
  phone: '',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

### Step 2: Test Backend Endpoints
- `GET /api/auth/me` with cookie or Authorization: Bearer <session_token>
- `GET /api/events` public
- `POST /api/events/:id/save` requires auth
- `POST /api/admin/login` with email=admin@clann.com, password=Clann@2026 → returns admin_token
- `POST /api/events` with X-Admin-Token header

### Step 3: Playwright Cookie Setup
```javascript
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "clann-upskill.preview.emergentagent.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
```

### Success Indicators
- ✅ /api/auth/me returns user data
- ✅ Home page loads for anonymous users
- ✅ Admin can add events after login at /admin-clann-secret
