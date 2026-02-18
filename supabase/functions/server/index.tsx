import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Create Supabase client for auth verification
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-04c71c6f/health", (c) => {
  return c.json({ status: "ok" });
});

// Get all bookmarks for the authenticated user
app.get("/make-server-04c71c6f/bookmarks", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user?.id) {
      console.log('Authorization error while getting bookmarks:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get bookmarks for this user from KV store
    const bookmarks = await kv.getByPrefix(`bookmarks:${user.id}:`);
    
    return c.json({ 
      bookmarks: bookmarks.map(b => b.value)
    });
  } catch (error) {
    console.log('Error fetching bookmarks:', error);
    return c.json({ error: 'Failed to fetch bookmarks', details: String(error) }, 500);
  }
});

// Add a new bookmark
app.post("/make-server-04c71c6f/bookmarks", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user?.id) {
      console.log('Authorization error while adding bookmark:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { url, title } = body;

    if (!url || !title) {
      return c.json({ error: 'URL and title are required' }, 400);
    }

    // Create bookmark object
    const bookmarkId = crypto.randomUUID();
    const bookmark = {
      id: bookmarkId,
      url,
      title,
      userId: user.id,
      createdAt: new Date().toISOString()
    };

    // Store in KV store with key pattern: bookmarks:userId:bookmarkId
    await kv.set(`bookmarks:${user.id}:${bookmarkId}`, bookmark);

    return c.json({ bookmark });
  } catch (error) {
    console.log('Error adding bookmark:', error);
    return c.json({ error: 'Failed to add bookmark', details: String(error) }, 500);
  }
});

// Delete a bookmark
app.delete("/make-server-04c71c6f/bookmarks/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user?.id) {
      console.log('Authorization error while deleting bookmark:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const bookmarkId = c.req.param('id');
    
    // Delete from KV store
    await kv.del(`bookmarks:${user.id}:${bookmarkId}`);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting bookmark:', error);
    return c.json({ error: 'Failed to delete bookmark', details: String(error) }, 500);
  }
});

Deno.serve(app.fetch);