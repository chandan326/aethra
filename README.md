# Aethra — Create. Inspire. Belong.

Aethra is a polished, full-stack creative web platform where creators share AI-generated images, GIFs, and sticker packs. It allows creators to build custom channels, toggle post visibility, list free or paid digital assets, and query a personal AI creative assistant.

---

## 📁 Directory Structure

```text
EXPERIMENT/
├── index.html            # Main SPA frontend (polished UI & theme)
├── Dockerfile            # Production Docker image configuration
├── docker-compose.yml    # Runs app container + local MongoDB database
├── vercel.json           # Vercel Serverless hosting config
├── .gitignore            # Git exclusion rules
├── server/
│   ├── server.js         # Express entrypoint & database connection
│   ├── package.json      # Node.js backend dependencies & scripts
│   ├── middleware/
│   │   └── auth.js       # JWT validation middleware
│   ├── models/
│   │   ├── User.js       # User auth & profile schema
│   │   ├── Post.js       # AI images, GIFs & stickers schema
│   │   └── Channel.js    # Creator channels schema
│   ├── routes/
│   │   ├── auth.js       # Register, Login & Session APIs
│   │   ├── posts.js      # CRUD posts & upload (with Multer)
│   │   ├── channels.js   # Channels & subscriptions list
│   │   └── chat.js       # Gemini AI chatbot proxy
│   └── utils/
│       └── seeder.js     # Automatic Database Seeder
```

---

## ⚡ Local Setup

### Prerequisites
1. **Node.js** (v16 or higher)
2. **MongoDB** (local server running or a remote MongoDB Atlas connection string)

### 1. Configure Environment Variables
Create a file named `.env` inside the `server/` directory (or use the existing one) and configure the variables:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/aethra
JWT_SECRET=change_this_to_a_long_random_string_for_production

# Optional: Set this to enable Gemini AI Chatbot proxy.
# If omitted, Aethra AI falls back to a realistic local assistant responder.
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 2. Install Dependencies & Run
From the root of the workspace:

```bash
# Navigate to server folder and install dependencies
cd server
npm install

# Start the Express server (starts on http://localhost:5000)
npm start
```
Open **`http://localhost:5000`** in your browser. The Express server serves the static frontend directly!

---

## 🌱 Automatic Database Seeding
To make the site look populated immediately:
- The first time the server successfully connects to MongoDB, if the database is empty, Aethra automatically creates 6 mock creators, 5 channels, and 9 posts.
- These posts will automatically load onto the Explorer page, AI Images page, GIFs, Stickers, and Channels grids!

---

## 🐳 Docker Deployment (Recommended)
You can build and run the entire stack (Express server + local MongoDB container) using Docker.

From the root of the workspace, run:
```bash
docker-compose up --build
```
The application will build, initialize a database container, run the seeder, and be available at **`http://localhost:5000`**.

---

## ☁️ Cloud Deployments

### Vercel Serverless
Aethra is pre-configured for Vercel out of the box using `vercel.json`:
1. Push your code to a GitHub repository.
2. Link the repository to your Vercel Dashboard.
3. Configure the environment variables (`MONGO_URI`, `JWT_SECRET`, and `GEMINI_API_KEY`) in Vercel.
4. Deploy!

### AWS / Docker Platforms
For AWS Elastic Beanstalk, ECS, or Render, simply build the Docker container using the provided `Dockerfile`. The container runs as a self-contained web server listening on the port specified by the `PORT` environment variable.
