# Our Space 💕

A private two-person relationship web app. Share posts, track finances together, customize your shared space, and see everything you've done in one activity log.

**Stack:** React + Vite + TailwindCSS • Node.js + Express • SQLite • PM2 • Nginx

---

## 1. Recommended Hosting

### Primary: Contabo VPS S — ~$7.50/month
- **Specs:** 4 vCPU, 8GB RAM, 200GB SSD NVMe
- **Why:** Cheapest VPS with enough RAM for Node + SQLite + media storage. European datacenters with Asian options (Singapore, Japan). No traffic limits.
- **Get it:** [contabo.com](https://contabo.com)

### Alternative: DigitalOcean Droplet Basic — $6/month
- **Specs:** 1 vCPU, 1GB RAM, 25GB SSD
- **Why:** Cheaper, simpler dashboard. Tighter on RAM but perfectly fine for this 2-user app.
- **Get it:** [digitalocean.com](https://digitalocean.com)

### Domain
- Buy from **[Niagahoster](https://niagahoster.co.id)** or **[Domainesia](https://domainesia.com)** — IDR-friendly pricing, cheap `.com` and `.id` domains.
- Point your domain's **A record** to your VPS IP address.

---

## 2. Prerequisites

- ✅ Ubuntu 22.04 fresh VPS
- ✅ A domain pointed to the VPS IP (A record configured)
- ✅ SSH access as root or sudo user

---

## 3. Server Setup

SSH into your VPS and run these commands in order:

### 3.1 Update system
```bash
apt update && apt upgrade -y
```

### 3.2 Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v  # Should show v20.x.x
```

### 3.3 Install PM2
```bash
npm install -g pm2
```

### 3.4 Install Nginx
```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 3.5 Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### 3.6 Create app user (non-root)
```bash
adduser ourspace
usermod -aG sudo ourspace
```

### 3.7 Create data directories
```bash
mkdir -p /var/data/ourspace/uploads
mkdir -p /var/log/ourspace
chown -R ourspace:ourspace /var/data/ourspace
chown -R ourspace:ourspace /var/log/ourspace
```

---

## 4. App Deployment

### 4.1 Switch to app user
```bash
su - ourspace
```

### 4.2 Upload the project
```bash
# Option A: Clone from Git
git clone <your-repo-url> ~/app
cd ~/app

# Option B: Upload via SCP (from your local machine)
# scp -r ./Our_Space ourspace@your-server-ip:~/app
```

### 4.3 Install server dependencies
```bash
cd ~/app/server
npm install --production
```

### 4.4 Build the client
```bash
cd ~/app/client
npm install
npm run build
```

### 4.5 Configure environment
```bash
cd ~/app
cp .env.example .env
nano .env
```

Fill in these values:
```
NODE_ENV=production
PORT=3001
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<run the same command again for a DIFFERENT secret>
DB_PATH=/var/data/ourspace/ourspace.db
UPLOADS_PATH=/var/data/ourspace/uploads
CORS_ORIGIN=https://yourdomain.com
```

### 4.6 Run setup wizard (ONCE)
```bash
cd ~/app
node setup-wizard.js
```

Follow the prompts to create both user accounts. This:
- Creates the SQLite database with all tables
- Seeds your two accounts with bcrypt-hashed passwords
- Writes a `.setup-complete` flag (cannot run twice)

### 4.7 Configure Nginx
```bash
# As root or with sudo:
exit  # back to root if needed
cp /home/ourspace/app/nginx.conf /etc/nginx/sites-available/ourspace
```

Edit the config to replace `yourdomain.com` with your actual domain:
```bash
nano /etc/nginx/sites-available/ourspace
```

Also update the `root` path if your app is not at `/home/ourspace/app`:
```
root /home/ourspace/app/client/dist;
```

Enable and test:
```bash
ln -s /etc/nginx/sites-available/ourspace /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remove default site
nginx -t
systemctl reload nginx
```

### 4.8 Start with PM2
```bash
su - ourspace
cd ~/app
pm2 start ecosystem.config.js
pm2 save
```

### 4.9 Enable PM2 startup on reboot
```bash
pm2 startup
```
Copy and run the command PM2 outputs (it will look like `sudo env PATH=... pm2 startup ...`), then:
```bash
pm2 save
```

---

## 5. HTTPS (Let's Encrypt)

```bash
# As root or with sudo:
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot will automatically:
- Obtain the SSL certificate
- Update your Nginx config
- Set up auto-redirect from HTTP to HTTPS

Verify auto-renewal:
```bash
certbot renew --dry-run
```

---

## 6. Updating the App

```bash
su - ourspace
cd ~/app

# Pull new code
git pull

# Update server
cd server
npm install --production

# Rebuild client
cd ../client
npm install
npm run build

# Zero-downtime reload
pm2 reload ourspace
```

---

## 7. Backup

### Manual backup
```bash
# SQLite database only
cp /var/data/ourspace/ourspace.db /var/data/ourspace/ourspace.db.bak

# Full backup (database + uploads)
tar -czf /root/ourspace-backup-$(date +%Y%m%d).tar.gz /var/data/ourspace/
```

### Automated daily backup (cron)
```bash
crontab -e
```

Add this line:
```
0 3 * * * tar -czf /root/backups/ourspace-$(date +\%Y\%m\%d).tar.gz /var/data/ourspace/ 2>/dev/null
```

Create the backup directory:
```bash
mkdir -p /root/backups
```

---

## 8. Troubleshooting

| Issue | Command / Solution |
|---|---|
| View live logs | `pm2 logs ourspace` |
| Check PM2 status | `pm2 status` |
| Test Nginx config | `nginx -t` |
| Reload Nginx | `systemctl reload nginx` |
| App crashes on start | Check DB path permissions: `ls -la /var/data/ourspace/` |
| 413 error on upload | Check `client_max_body_size` in `/etc/nginx/sites-available/ourspace` |
| Can't login | Check `CORS_ORIGIN` in `.env` matches your domain exactly |
| Blank page after build | Ensure Nginx `root` points to `client/dist/` and `try_files` includes `/index.html` |
| PM2 not starting on reboot | Re-run `pm2 startup` and `pm2 save` |
| SSL certificate expired | Run `certbot renew` |

### Log files
- PM2 error log: `/var/log/ourspace/error.log`
- PM2 output log: `/var/log/ourspace/out.log`
- Nginx access log: `/var/log/nginx/access.log`
- Nginx error log: `/var/log/nginx/error.log`

---

## Modules

1. **Posts Feed** — Create posts with text, images, video, audio, and voice notes. Like and comment.
2. **Financial Tracker** — Shared income/expense tracking with charts (donut + bar). IDR currency.
3. **Profile & Theme** — Editable profiles, 4 theme presets + custom colors.
4. **Activity Log** — Auto-logged timeline of all actions with filters.

---

Made with ♥ for two.
