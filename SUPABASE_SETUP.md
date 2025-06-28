# Supabase Service Role Key Setup

To enable automatic auth user creation (like for Charlene), you need to configure your service role key.

## 🔧 Quick Setup Steps

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project: `cfjvskafvcljvxnawccs`

2. **Get your Service Role Key**
   - Navigate to: **Settings → API**
   - Copy the **`service_role`** key (NOT the `anon` key)
   - It should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. **Create Environment File**
   - In your project root, create/edit `.env.local`
   - Add this line:
   ```
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

4. **Restart Development Server**
   ```bash
   cd project
   npm run dev
   ```

## 🎯 After Setup

Once configured, the "Create Auth Account" button will:
- ✅ Automatically create auth users
- ✅ Set passwords
- ✅ Auto-confirm emails
- ✅ Link database and auth records

## 🔄 Manual Alternative (If you prefer not to use service key)

For Charlene specifically:
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Email: `charlene@example.com` (or her actual email)
4. Password: `charlene123`
5. Enable "Auto Confirm User"
6. Click "Create User"

## 🔒 Security Note

The service role key has admin privileges. Only use it in:
- ✅ Server-side code
- ✅ Admin functions
- ✅ Development environment
- ❌ Never expose in client-side code in production 