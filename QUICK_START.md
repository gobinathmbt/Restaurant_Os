# Quick Start Guide - RestaurantOS

## 🚀 Get Started in 3 Steps

### 1. Start Backend Server

```bash
cd backend
npm run dev
```

Server runs on: `http://localhost:5000`

### 2. Start Frontend Server

```bash
cd frontend
npm run dev
```

App runs on: `http://localhost:5173`

### 3. Open Browser

Navigate to: `http://localhost:5173`

## 🎯 What You'll See

### Landing Page Features
- ✅ Animated hero section
- ✅ 8 feature cards
- ✅ Statistics with animated counters
- ✅ Pricing section
- ✅ Customer testimonials
- ✅ Smooth scroll navigation
- ✅ Scroll-to-top button

### Authentication
- ✅ Login with email/password
- ✅ Register new company
- ✅ Sign in with Google
- ✅ Animated forms
- ✅ Error handling

## 🔑 Test Accounts

### Email/Password Login
Create a new account using the registration form.

### Google OAuth
Click "Sign in with Google" and use any Google account.

**First-time users**: Complete the registration form after Google authentication.

## 📱 Test Responsive Design

1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test different screen sizes:
   - Mobile: 375px
   - Tablet: 768px
   - Desktop: 1440px

## 🎨 Theme

The app uses a green, black, and white color scheme:
- Primary: Green (#22c55e)
- Background: Black/Dark
- Text: White/Light

## 🔗 Quick Links

- **Landing**: http://localhost:5173
- **Login**: http://localhost:5173/auth?mode=login
- **Register**: http://localhost:5173/auth?mode=register
- **API Docs**: http://localhost:5000/api

## 📚 Documentation

- `IMPLEMENTATION_SUMMARY.md` - Complete feature list
- `GOOGLE_OAUTH_SETUP.md` - Google OAuth setup guide
- `frontend/src/components/landing/README.md` - Landing page components

## 🐛 Troubleshooting

### Backend won't start
```bash
cd backend
npm install
npm run dev
```

### Frontend won't start
```bash
cd frontend
npm install
npm run dev
```

### Google OAuth not working
1. Check `GOOGLE_CLIENT_ID` in `frontend/src/lib/config.ts`
2. Verify backend `.env` has correct credentials
3. See `GOOGLE_OAUTH_SETUP.md` for detailed setup

### CORS errors
Backend CORS is configured for `http://localhost:5173`. If using different port, update `backend/server.js`.

## ✅ Checklist

Before testing:
- [ ] Backend server running
- [ ] Frontend server running
- [ ] MongoDB running (for backend)
- [ ] Browser opened to http://localhost:5173

## 🎉 Features to Test

1. **Landing Page**
   - [ ] Smooth scroll navigation
   - [ ] Animated sections
   - [ ] Responsive design
   - [ ] All links working

2. **Authentication**
   - [ ] Login with email/password
   - [ ] Register new company
   - [ ] Google OAuth login
   - [ ] Form validation
   - [ ] Error messages

3. **Animations**
   - [ ] Hero section animations
   - [ ] Feature card hover effects
   - [ ] Counter animations
   - [ ] Scroll-triggered animations
   - [ ] Form transitions

## 💡 Tips

- Use Chrome DevTools for best debugging experience
- Check browser console for any errors
- Test on multiple browsers (Chrome, Firefox, Safari)
- Test on real mobile devices if possible

## 🚨 Important Notes

1. **Google OAuth**: Currently configured with development credentials. Update for production!
2. **Database**: Make sure MongoDB is running before starting backend
3. **Environment**: Check `.env` files in both frontend and backend

## 📞 Need Help?

1. Check error messages in browser console
2. Check backend logs in terminal
3. Review documentation files
4. Verify all dependencies are installed

---

**Ready to go!** 🎉

Start both servers and navigate to http://localhost:5173 to see your awesome landing page!
