# Deploying Our Space to the Internet 🚀

This guide will help you take your "Our Space" app from your local computer and deploy it live on the internet so that you and your partner can access it from anywhere using your phones or computers.

Since you are looking for a cheap, beginner-friendly "plug and play" solution, we will use **Render.com**. Render is a modern cloud hosting platform that offers a free tier for both web services and databases, making it perfect for small apps like this.

---

## Step 1: Share Your Code to GitHub
Before deploying, your code needs to be on GitHub. Render will pull your code directly from GitHub whenever you make changes.

### 1. Create a GitHub Account
If you don't have one, sign up at [GitHub](https://github.com/).

### 2. Create a New Repository
1. Click the **"+"** icon in the top right of GitHub and select **"New repository"**.
2. Name it `our-space`.
3. Set it to **Private** (so only you and people you invite can see your code and posts).
4. Click **"Create repository"**.

### 3. Push Your Code to GitHub
Open your terminal (or command prompt), navigate to your `Our_Space` folder, and run the following commands:

```bash
# Initialize a git repository if you haven't already
git init

# Add all your files
git add .

# Commit your files
git commit -m "Initial commit for Our Space"

# Link your local folder to your GitHub repository
# (Replace YOUR_USERNAME with your actual GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/our-space.git

# Push your code to GitHub
git branch -M main
git push -u origin main
```

---

## Step 2: Preparing for Deployment
Because SQLite (the database we use) saves data to a file (`ourspace.db`), and Render's free servers restart occasionally (which wipes local files), we need to use a **Persistent Disk**.

Don't worry, Render makes this easy!

Also, we need to build the React frontend so the server can serve it.

### 1. Update `package.json`
To make Render build your app automatically, make sure your root `package.json` has these scripts:

```json
{
  "scripts": {
    "start": "node server/index.js",
    "build": "cd client && npm install && npm run build",
    "setup": "npm install && cd server && npm install"
  }
}
```
*(Note: I have already configured your app to serve the built React files from the backend, so you only need one Render service!)*

---

## Step 3: Deploy to Render.com

### 1. Create a Render Account
Sign up at [Render.com](https://render.com/) using your GitHub account.

### 2. Create a New Web Service
1. In the Render Dashboard, click **"New"** -> **"Web Service"**.
2. Choose **"Build and deploy from a Git repository"**.
3. Connect your GitHub account and select your `our-space` repository.

### 3. Configure the Web Service
Fill in the details:
- **Name**: `our-space-app` (or whatever you like)
- **Region**: Choose the one closest to you (e.g., Singapore if you are in Asia).
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**: `npm run setup && npm run build`
- **Start Command**: `npm start`
- **Instance Type**: Select the **Free** tier.

### 4. Add Environment Variables
Scroll down and click **"Advanced"**, then click **"Add Environment Variable"**. Add these:

1. **Key**: `NODE_ENV` | **Value**: `production`
2. **Key**: `JWT_SECRET` | **Value**: *(Generate a random long string of characters and paste it here)*
3. **Key**: `PORT` | **Value**: `10000`

### 5. Add a Persistent Disk (For your Database and Uploads)
Because we are using SQLite and storing images, we need a place to save them permanently so they don't disappear when the server restarts.

1. Still in the **"Advanced"** section, click **"Add Disk"**.
2. **Name**: `data`
3. **Mount Path**: `/var/data`
4. **Size**: `1 GB` (The free tier gives you enough space for lots of memories).

Now, add these two Environment Variables so the app knows to save data to the disk:
1. **Key**: `DB_PATH` | **Value**: `/var/data/ourspace.db`
2. **Key**: `UPLOADS_PATH` | **Value**: `/var/data/uploads`

### 6. Deploy!
Click **"Create Web Service"**.
Render will now download your code from GitHub, install dependencies, build your React app, and start your server. 
This process takes about 3-5 minutes. You can watch the logs to see the progress.

---

## Step 4: Access Your Live App
Once Render says **"Live"**, you will see a URL at the top left (e.g., `https://our-space-app.onrender.com`).

1. Open this URL on your phone or computer.
2. Sign up with your usernames (e.g., "Hafi" and "Lila").

### Promoting Yourself to Admin
Now that the app is live, you need to make yourself an Admin so you can delete unwanted posts or activity logs.

1. In the Render Dashboard, go to your Web Service.
2. Click on the **"Shell"** tab on the left menu.
3. Type the following command to promote your account (replace `Hafi` with your actual username):

```bash
node server/scripts/make-admin.js Hafi
```

You will see a success message. When you log in to the app, you will now see "Delete" buttons on all posts and activity logs!

---

## Step 5: Inviting Your Partner
Send the Render URL (e.g., `https://our-space-app.onrender.com`) to your partner. They can open it on their phone, create their account, and you can start sharing your space immediately!

*Tip: On iPhones or Androids, they can tap **"Share" -> "Add to Home Screen"** to make the website look and act exactly like a native app.*

### Enjoy your new Space! 💛🖤
