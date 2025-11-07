# Render Deployment Guide

## Keep-Alive Setup for Free Tier

Render's free tier spins down services after 15 minutes of inactivity. This guide shows how to keep your server alive using the built-in health check and keep-alive script.

## Health Endpoint

A `/health` endpoint has been added to the server that returns:

```json
{
  "status": "ok",
  "timestamp": "2025-10-22T19:18:50.790Z",
  "uptime": 3.005766353,
  "environment": "development"
}
```

This endpoint can be used for:
- Render health checks
- Keep-alive pings
- Monitoring and uptime services

## Keep-Alive Script

The `scripts/keepAlive.js` script automatically pings your server to prevent it from sleeping.

### How It Works

1. Pings the `/health` endpoint at regular intervals
2. Logs successful and failed health checks
3. Prevents Render from spinning down your service
4. Uses environment variables for configuration

### Environment Variables

Add these to your Render service:

```env
# Required: Your Render service URL
HEALTH_CHECK_URL=https://your-service.onrender.com

# Optional: Ping interval in milliseconds (default: 14 minutes)
KEEP_ALIVE_INTERVAL=840000
```

**Note**: Render automatically sets `RENDER_EXTERNAL_URL`, so you can use that instead of `HEALTH_CHECK_URL`.

## Deployment Options

### Option 1: Separate Background Worker (Recommended)

Create a **Background Worker** service on Render:

1. **Service Type**: Background Worker
2. **Build Command**: `npm install`
3. **Start Command**: `npm run keepalive`
4. **Environment Variables**:
   ```
   HEALTH_CHECK_URL=https://your-main-service.onrender.com
   KEEP_ALIVE_INTERVAL=840000
   ```

**Pros**:
- Dedicated service for keep-alive
- Main server stays clean
- Easy to enable/disable
- Can monitor separately

**Cons**:
- Uses an additional free service slot

### Option 2: External Cron Service (Free)

Use a free cron service to ping your health endpoint:

**Services**:
- [cron-job.org](https://cron-job.org) - Free, reliable
- [UptimeRobot](https://uptimerobot.com) - Free tier includes 50 monitors
- [Cronitor](https://cronitor.io) - Free tier available

**Setup**:
1. Create an account
2. Add a new monitor/job
3. Set URL: `https://your-service.onrender.com/health`
4. Set interval: Every 14 minutes
5. Method: GET

**Pros**:
- No additional Render service needed
- External monitoring included
- Email alerts on downtime

**Cons**:
- Depends on third-party service
- Less control over timing

### Option 3: Run Alongside Main Server

Add to your main server's start command:

```bash
node src/server.js & npm run keepalive
```

**Pros**:
- Single service
- No external dependencies

**Cons**:
- Both processes share resources
- If main server crashes, keep-alive stops

## Render Configuration

### Web Service Setup

1. **Build Command**: `npm install`
2. **Start Command**: `npm start`
3. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   API_BASE_URL=https://your-service.onrender.com
   S3_BUCKET_NAME=your_s3_bucket
   AWS_ACCESS_KEY_ID=your_aws_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret
   AWS_REGION=us-east-1
   ```

### Health Check Path

In Render's service settings:
- **Health Check Path**: `/health`
- This tells Render to use your endpoint for health monitoring

## Testing Locally

Test the health endpoint:
```bash
curl http://localhost:5000/health
```

Test the keep-alive script:
```bash
export HEALTH_CHECK_URL="http://localhost:5000"
export KEEP_ALIVE_INTERVAL="10000"
npm run keepalive
```

## Monitoring

The keep-alive script logs all health checks:

```
✅ Health check successful (12ms) - 2025-10-22T19:18:50.790Z
✅ Health check successful (15ms) - 2025-10-22T19:32:50.805Z
⚠️  Health check returned status 503 (120ms)
❌ Health check failed (5000ms): ECONNREFUSED
```

View logs in Render dashboard under your service's "Logs" tab.

## Timing Considerations

- **Render spin-down**: 15 minutes of inactivity
- **Default interval**: 14 minutes (840,000ms)
- **First ping**: 1 minute after script starts
- **Safety margin**: 1 minute before spin-down

## Troubleshooting

### Service Still Spinning Down

1. Check keep-alive script is running
2. Verify `HEALTH_CHECK_URL` is correct
3. Check logs for failed health checks
4. Ensure interval is less than 15 minutes

### Health Check Failing

1. Verify `/health` endpoint is accessible
2. Check server is running on correct port
3. Review server logs for errors
4. Test endpoint manually with curl

### High Response Times

If health checks take too long:
1. Check database connection
2. Review server performance
3. Consider upgrading Render plan
4. Optimize server startup time

## Cost Considerations

**Free Tier Limits**:
- 750 hours/month per service
- Services spin down after 15 minutes
- 100GB bandwidth/month

**Keep-Alive Impact**:
- Background worker: Uses another service slot
- External cron: No additional Render cost
- Bandwidth: ~1-2MB/month (negligible)

## Alternative: Paid Plan

Consider Render's paid plans ($7/month) if:
- You need 24/7 uptime without keep-alive
- You want faster cold starts
- You need more resources
- You want to avoid keep-alive complexity

## Security Notes

- The `/health` endpoint is public (no authentication required)
- It only returns non-sensitive server status
- No user data or secrets are exposed
- Safe to call from external services

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Render Free Tier Details](https://render.com/docs/free)
- [Health Checks on Render](https://render.com/docs/health-checks)
