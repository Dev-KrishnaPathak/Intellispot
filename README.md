# 🌐 IntelliSpot

> Find the perfect spot around you with real-time, context-aware recommendations.  

IntelliSpot combines **live weather, traffic, distance, and calendar integration** with smart suggestions to recommend the best places near you.  

---

## ✨ Features

- 🧠 **Smart Spot Recommendations** – Context-aware suggestions for restaurants, cafes, and venues  
- 🌦️ **Weather-Aware** – Integrated weather API to filter recommendations  
- 🚦 **Traffic Insights** – Live traffic data for better planning (none / moderate / high)  
- 📍 **Distance & Time** – Google Maps API for accurate distance and ETA  
- 📅 **Calendar Sync** – Google Calendar integration to recommend spots based on your schedule  
- 🔑 **OAuth Login** – Secure login with Google Client OAuth  
- ⚡ **Seamless Frontend + Backend** – Modern React frontend with a Node.js backend  

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TailwindCSS  
- **Backend**: Node.js, Express  
- **APIs**:  
  - [Foursquare Places API](https://location.foursquare.com/)  
  - [Google Maps API](https://developers.google.com/maps)  
  - [Google Client OAuth](https://developers.google.com/identity/protocols/oauth2)  
  - [Weather API](https://www.weatherapi.com/)  
- **Deployment**:  
  - Frontend → [Vercel](https://vercel.com)  
  - Backend → [Railway](https://railway.app)  

---

## 🚀 Deployment

- **Frontend (Vercel)**  
  - Connect the `web` directory to Vercel  
  - Add environment variables in **Vercel Dashboard → Project Settings → Environment Variables**  

- **Backend (Railway)**  
  - Deploy the `backend` folder to Railway  
  - Add environment variables in **Railway Dashboard → Variables**  

---

## 📂 Project Structure

```bash
IntelliSpot/
│
├── backend/          # Express backend (API integrations, authentication, traffic/weather handlers)
├── web/              # React frontend (UI, user interactions, smart suggestions)
├── .gitignore        # Root gitignore (node_modules, .env, build files etc.)
├── README.md         # Project documentation

⚙️ Environment Variables

Both frontend and backend need environment variables set in deployment platforms.
Example .env entries (do not commit these to GitHub):

# Google APIs
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_API_KEY=your_google_maps_api_key

# Foursquare
FOURSQUARE_API_KEY=your_foursquare_api_key

# Weather API
WEATHER_API_KEY=your_weather_api_key

# OAuth Callback URL
OAUTH_REDIRECT_URI=https://yourdomain.com/auth/callback

👥 Team

Mahak Parihar – Developer

Krishna Pathak – Developer