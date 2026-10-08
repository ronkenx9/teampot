// Vercel entry: every /api/* request is routed here (see vercel.json).
import { handle } from 'hono/vercel'
import { app } from '../server/app.js'
export const config = { maxDuration: 60 }
export default handle(app)
