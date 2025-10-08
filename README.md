# Frontline Pricing Demo

## Basic Authentication on Vercel

This project has been configured to require HTTP Basic Authentication for every request when deployed to Vercel. All traffic is routed through the [`api/basic-auth.ts`](api/basic-auth.ts) serverless function, which validates the provided credentials before proxying static assets from the Vite build output.

### Configure credentials

Set the following environment variables in your Vercel project (Project Settings → Environment Variables):

- `BASIC_AUTH_USERNAME`
- `BASIC_AUTH_PASSWORD`

After updating the variables, redeploy the project for the changes to take effect.

### Local development

The authentication layer is only active in the Vercel deployment. Local development with `npm run dev` behaves the same as before.
