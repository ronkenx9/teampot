// Vercel entry: every /api/* request is routed here (see vercel.json); fetch-style handlers per method.
import { handle } from 'hono/vercel'
import { app } from '../server/app.js'
const h = handle(app)
export const GET = h
export const POST = h
