import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { hashPassword, randomHex, verifyPassword } from "./lib/password";
import { getUser, requireRole } from "./lib/session";
import { role } from "./schema";

const SESSION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const publicUser = (u: { _id: Id<"users">; email: string; name: string; role: string }) => ({
  _id: u._id,
  email: u.email,
  name: u.name,
  role: u.role,
});

export const register = action({
  args: { email: v.string(), name: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const email = args.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ConvexError("Enter a valid email address");
    if (args.password.length < 8) throw new ConvexError("Password must be at least 8 characters");
    if (!args.name.trim()) throw new ConvexError("Name is required");
    const { hash, salt } = await hashPassword(args.password);
    return await ctx.runMutation(internal.auth.createUserAndSession, {
      email,
      name: args.name.trim(),
      passwordHash: hash,
      passwordSalt: salt,
      token: randomHex(32),
    });
  },
});

export const createUserAndSession = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    token: v.string(),
  },
  handler: async (ctx, { token, ...args }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) throw new ConvexError("An account with that email already exists");
    const isFirst = (await ctx.db.query("users").first()) === null;
    const userId = await ctx.db.insert("users", {
      ...args,
      role: isFirst ? "admin" : "staff",
      active: true,
      createdAt: Date.now(),
    });
    await ctx.db.insert("sessions", { userId, token, expiresAt: Date.now() + SESSION_MS });
    await logAudit(ctx, { _id: userId, name: args.name }, {
      action: "register",
      entityType: "user",
      entityId: userId,
      summary: `Account created for ${args.email} (${isFirst ? "admin" : "staff"})`,
    });
    return { token };
  },
});

export const login = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.runQuery(internal.auth.userByEmail, { email });
    const ok =
      !!user && user.active && (await verifyPassword(args.password, user.passwordSalt, user.passwordHash));
    const token = ok ? randomHex(32) : undefined;
    await ctx.runMutation(internal.auth.recordLogin, { email, userId: ok ? user!._id : undefined, token });
    if (!ok || !token) throw new ConvexError("Incorrect email or password");
    return { token };
  },
});

export const userByEmail = internalQuery({
  args: { email: v.string() },
  handler: (ctx, { email }) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique(),
});

export const recordLogin = internalMutation({
  args: { email: v.string(), userId: v.optional(v.id("users")), token: v.optional(v.string()) },
  handler: async (ctx, { email, userId, token }) => {
    const user = userId ? await ctx.db.get(userId) : null;
    if (user && token) {
      await ctx.db.insert("sessions", { userId: user._id, token, expiresAt: Date.now() + SESSION_MS });
    }
    await logAudit(ctx, user, {
      action: user ? "login" : "login_failed",
      entityType: "user",
      entityId: user?._id,
      summary: user ? `${user.name} signed in` : `Failed sign-in attempt for ${email}`,
    });
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .unique();
    if (!session) return;
    const user = await ctx.db.get(session.userId);
    await ctx.db.delete(session._id);
    await logAudit(ctx, user, {
      action: "logout",
      entityType: "user",
      entityId: session.userId,
      summary: `${user?.name ?? "User"} signed out`,
    });
  },
});

export const me = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await getUser(ctx, sessionToken);
    return user ? publicUser(user) : null;
  },
});

export const listUsers = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireRole(ctx, sessionToken, ["admin", "manager"]);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ ...publicUser(u), active: u.active, createdAt: u.createdAt }));
  },
});

export const updateUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    role: v.optional(role),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionToken, userId, ...patch }) => {
    const admin = await requireRole(ctx, sessionToken, ["admin"]);
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    if (target._id === admin._id && (patch.role !== undefined || patch.active === false)) {
      throw new ConvexError("You can't change your own role or deactivate yourself");
    }
    await ctx.db.patch(userId, patch);
    await logAudit(ctx, admin, {
      action: "update",
      entityType: "user",
      entityId: userId,
      summary: `Updated ${target.name}: ${Object.entries(patch)
        .filter(([, val]) => val !== undefined)
        .map(([k, val]) => `${k}=${val}`)
        .join(", ")}`,
      changes: patch,
    });
  },
});
